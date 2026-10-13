import {describe,it,expect} from 'vitest';
import {planInstrumentNotes,savedInstrumentPlan} from './instrumentPlan';
describe('instrument note plan',()=>{
 it('samples nine notes over two octaves at three-semitone spacing',()=>expect(planInstrumentNotes(48,72,3)).toEqual([48,51,54,57,60,63,66,69,72]));
 it('includes the selected endpoint when spacing is uneven',()=>expect(planInstrumentNotes(48,62,6)).toEqual([48,54,60,62]));
 it('allows a single note',()=>expect(planInstrumentNotes(60,60,1)).toEqual([60]));
 it('does not truncate a range that exceeds capacity',()=>expect(()=>planInstrumentNotes(48,72,1)).toThrow(/24/));
 it.each([[72,48,3],[48,72,0],[-1,72,3],[48,128,12],[48.5,60,3]])('rejects invalid plan %s %s %s',(a,b,c)=>expect(()=>planInstrumentNotes(a,b,c)).toThrow());
});

it('recovers wider and non-divisible ranges from saved sample roots',()=>{
 expect(savedInstrumentPlan([48,51,54,57,60,63,66,69,72])).toEqual({first:48,last:72,spacing:3});
 expect(savedInstrumentPlan([36,42,48,54,60,66,72,78,84])).toEqual({first:36,last:84,spacing:6});
 expect(savedInstrumentPlan([48,60,72,73])).toEqual({first:48,last:73,spacing:12});
 expect(savedInstrumentPlan([])).toBeNull();
 expect(savedInstrumentPlan([48,48])).toBeNull();
});
