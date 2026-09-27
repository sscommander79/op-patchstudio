import type { ImportedPresetJson } from './jsonImport';
import type { LoopCrossfadeProvenance, MultisampleFile } from '../context/AppContext';

type JsonRecord = Record<string, unknown>;

interface ImportedCrossfadeRegion {
  identity: string;
  crossfade: LoopCrossfadeProvenance;
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function sampleFileIdentity(sample: MultisampleFile): string | undefined {
  const relativePath = sample.file?.webkitRelativePath;
  if (relativePath) return relativePath;
  return sample.file?.name || sample.name || undefined;
}

function importedRegions(preset: ImportedPresetJson | null | undefined): {
  regions: ImportedCrossfadeRegion[];
  uninterpreted: number;
} {
  if (!preset || !Array.isArray(preset.regions)) return { regions: [], uninterpreted: 0 };
  const regions: ImportedCrossfadeRegion[] = [];
  let uninterpreted = 0;
  for (const value of preset.regions) {
    if (!isRecord(value) || !Object.hasOwn(value, 'loop.crossfade')) continue;
    const identity = value.sample;
    const raw = value['loop.crossfade'];
    const framecount = value.framecount;
    if (
      typeof identity !== 'string' || identity.length === 0 ||
      typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0 ||
      typeof framecount !== 'number' || !Number.isSafeInteger(framecount) || framecount < 1
    ) {
      uninterpreted += 1;
      continue;
    }
    regions.push({
      identity,
      crossfade: {
        fraction: raw / framecount,
        importedRaw: raw,
        importedFramecount: framecount,
        sourceIdentity: identity,
      },
    });
  }
  return { regions, uninterpreted };
}

export interface CrossfadeAssociationResult {
  files: MultisampleFile[];
  notice?: string;
}

interface CrossfadeAssociationOptions {
  replaceMatched?: boolean;
}

/** Associate only exact, unique identities. Raw imported JSON remains untouched. */
export function associateImportedCrossfades(
  files: readonly MultisampleFile[],
  preset: ImportedPresetJson | null | undefined,
  options: CrossfadeAssociationOptions = {},
): CrossfadeAssociationResult {
  const scan = importedRegions(preset);
  const { regions } = scan;
  if (regions.length === 0 && scan.uninterpreted === 0 && !options.replaceMatched) return { files: files.map((file) => ({ ...file })) };

  const fileCounts = new Map<string, number>();
  for (const file of files) {
    const identity = sampleFileIdentity(file);
    if (identity) fileCounts.set(identity, (fileCounts.get(identity) ?? 0) + 1);
  }
  const regionCounts = new Map<string, number>();
  for (const region of regions) regionCounts.set(region.identity, (regionCounts.get(region.identity) ?? 0) + 1);
  const uniqueRegions = new Map(
    regions.filter((region) => regionCounts.get(region.identity) === 1).map((region) => [region.identity, region]),
  );

  let matched = 0;
  let ambiguous = false;
  let aboveNormalRange = false;
  const mapped = files.map((file) => {
    const identity = sampleFileIdentity(file);
    if (!identity) return { ...file };
    if ((fileCounts.get(identity) ?? 0) !== 1 || (regionCounts.get(identity) ?? 0) > 1) {
      if ((regionCounts.get(identity) ?? 0) > 0) ambiguous = true;
      const existing = file.loopCrossfade;
      if (existing?.importedRaw !== undefined && existing.sourceIdentity === identity) {
        const withoutAssociation = { ...file };
        delete withoutAssociation.loopCrossfade;
        return withoutAssociation;
      }
      return { ...file };
    }
    const region = uniqueRegions.get(identity);
    if (!region) {
      if (options.replaceMatched && file.loopCrossfade?.importedRaw !== undefined) {
        const withoutAssociation = { ...file };
        delete withoutAssociation.loopCrossfade;
        return withoutAssociation;
      }
      return { ...file };
    }
    matched += 1;
    const effective = options.replaceMatched ? region.crossfade : (file.loopCrossfade ?? region.crossfade);
    aboveNormalRange ||= effective.fraction > 0.75;
    return { ...file, loopCrossfade: { ...effective } };
  });

  const unmatched = regions.length - matched;
  const messages: string[] = [];
  if (scan.uninterpreted > 0) {
    messages.push('Some imported crossfades could not be interpreted and were left only in the original JSON.');
  }
  if (unmatched > 0) {
    messages.push(ambiguous
      ? 'Some imported crossfades are ambiguous and were left only in the original JSON.'
      : 'Some imported crossfades could not be matched to an exact loaded file identity and were left only in the original JSON.');
  }
  if (aboveNormalRange) messages.push('An imported crossfade is above 75%; preview is approximate until you choose a normal value.');
  return { files: mapped, notice: messages.length ? messages.join(' ') : undefined };
}

export function importedCrossfadeNotice(
  files: readonly MultisampleFile[],
  preset: ImportedPresetJson | null | undefined,
): string | undefined {
  return associateImportedCrossfades(files, preset).notice;
}
