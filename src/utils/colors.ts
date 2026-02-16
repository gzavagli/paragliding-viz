import { Color } from 'cesium';

export const TRACK_COLORS = [
  Color.YELLOW,
  Color.CYAN,
  Color.MAGENTA,
  Color.ORANGE,
  Color.LIME,
  Color.RED,
  Color.CORNFLOWERBLUE,
  Color.PINK,
  Color.TEAL,
  Color.SALMON
];

export const getTrackColor = (index: number): Color => {
  return TRACK_COLORS[index % TRACK_COLORS.length];
};

export const getCssColor = (index: number): string => {
  const color = getTrackColor(index);
  return color.toCssColorString();
};
