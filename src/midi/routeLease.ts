export type RouteOwner = 'devices' | 'autosampling' | 'stem-capture';

export interface RouteLease {
  readonly outputId: string;
  readonly owner: RouteOwner;
  release(): void;
}

export type RouteLeaseListener = (outputId: string, owner: RouteOwner | undefined) => void;

export class RouteLeaseRegistry {
  private readonly owners = new Map<string, { owner: RouteOwner; token: symbol }>();
  private readonly listeners = new Set<RouteLeaseListener>();

  current(outputId: string): RouteOwner | undefined {
    return this.owners.get(outputId)?.owner;
  }

  subscribe(listener: RouteLeaseListener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  acquire(outputId: string, owner: RouteOwner): RouteLease | undefined {
    if (!outputId || this.owners.has(outputId)) return undefined;

    const token = Symbol(owner);
    this.owners.set(outputId, { owner, token });
    this.publish(outputId, owner);

    return {
      outputId,
      owner,
      release: () => {
        if (this.owners.get(outputId)?.token !== token) return;
        this.owners.delete(outputId);
        this.publish(outputId, undefined);
      },
    };
  }

  private publish(outputId: string, owner: RouteOwner | undefined): void {
    this.listeners.forEach(listener => listener(outputId, owner));
  }
}

export const midiRoutes = new RouteLeaseRegistry();
