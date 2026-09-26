// @implements SPEC-br-sprints
import type { elapsedRatio } from '../src/inspections/domain/sprint-progress.ts';
import type { ContractOf } from './contract-types.ts';

/** C-25: the elapsed ratio stays within 0..1, is 1 from the end date on and 0 up to the start date. Dates are `YYYY-MM-DD`, so they compare as text. */
export default {
  post: (ratio, startsOn, endsOn, today) => {
    if (!(ratio >= 0 && ratio <= 1)) return `elapsed ratio ${ratio} is outside 0..1`;
    if (today >= endsOn) return ratio === 1 ? true : 'not fully elapsed on or after the end date';
    if (today <= startsOn) return ratio === 0 ? true : 'elapsed before the sprint started';
    return true;
  },
} satisfies ContractOf<typeof elapsedRatio>;
