import { FIXED_SCALE, fixedFromRaw } from "./fixed.js";
import type { Fixed } from "./fixed.js";

const FULL_ROTATION_MILLI_DEGREES = 360_000;
const QUARTER_ROTATION_MILLI_DEGREES = 90_000;
const TABLE_STEP_MILLI_DEGREES = 1_000;
const TABLE_SCALE = 1_000_000;

const SINE_QUARTER_TABLE = [
  0, 17452, 34899, 52336, 69756, 87156, 104528, 121869, 139173, 156434, 173648, 190809, 207912,
  224951, 241922, 258819, 275637, 292372, 309017, 325568, 342020, 358368, 374607, 390731, 406737,
  422618, 438371, 453990, 469472, 484810, 500000, 515038, 529919, 544639, 559193, 573576, 587785,
  601815, 615661, 629320, 642788, 656059, 669131, 681998, 694658, 707107, 719340, 731354, 743145,
  754710, 766044, 777146, 788011, 798636, 809017, 819152, 829038, 838671, 848048, 857167, 866025,
  874620, 882948, 891007, 898794, 906308, 913545, 920505, 927184, 933580, 939693, 945519, 951057,
  956305, 961262, 965926, 970296, 974370, 978148, 981627, 984808, 987688, 990268, 992546, 994522,
  996195, 997564, 998630, 999391, 999848, 1000000,
] as const;

export function sinMilliDegrees(angleMilliDegrees: number): Fixed {
  const normalized = normalizeAngle(angleMilliDegrees);
  const quadrant = Math.floor(normalized / QUARTER_ROTATION_MILLI_DEGREES);
  const withinQuadrant = normalized % QUARTER_ROTATION_MILLI_DEGREES;
  const mirrored = quadrant === 1 || quadrant === 3;
  const baseAngle = mirrored ? QUARTER_ROTATION_MILLI_DEGREES - withinQuadrant : withinQuadrant;
  const sign = quadrant >= 2 ? -1 : 1;
  const tableValue = interpolateQuarter(baseAngle);
  return fixedFromRaw(Math.trunc((sign * tableValue * FIXED_SCALE) / TABLE_SCALE));
}

export function cosMilliDegrees(angleMilliDegrees: number): Fixed {
  if (!Number.isSafeInteger(angleMilliDegrees)) {
    throw new RangeError("angle must be a safe integer number of milli-degrees");
  }
  return sinMilliDegrees(angleMilliDegrees + QUARTER_ROTATION_MILLI_DEGREES);
}

export function normalizeAngle(angleMilliDegrees: number): number {
  if (!Number.isSafeInteger(angleMilliDegrees)) {
    throw new RangeError("angle must be a safe integer number of milli-degrees");
  }
  return (
    ((angleMilliDegrees % FULL_ROTATION_MILLI_DEGREES) + FULL_ROTATION_MILLI_DEGREES) %
    FULL_ROTATION_MILLI_DEGREES
  );
}

function interpolateQuarter(angleMilliDegrees: number): number {
  const lowerIndex = Math.floor(angleMilliDegrees / TABLE_STEP_MILLI_DEGREES);
  const remainder = angleMilliDegrees % TABLE_STEP_MILLI_DEGREES;
  const lower = SINE_QUARTER_TABLE[lowerIndex];
  if (lower === undefined) {
    throw new RangeError("trigonometry table index is out of range");
  }
  if (remainder === 0) {
    return lower;
  }
  const upper = SINE_QUARTER_TABLE[lowerIndex + 1];
  if (upper === undefined) {
    throw new RangeError("trigonometry interpolation index is out of range");
  }
  return lower + Math.trunc(((upper - lower) * remainder) / TABLE_STEP_MILLI_DEGREES);
}
