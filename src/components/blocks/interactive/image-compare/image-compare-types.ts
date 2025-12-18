export type ImageCompareStyle = {
  style: "light" | "dark";
  customBackgroundColor?: string | null;
};

export interface ImageCompareSettings {
  showLabels: boolean;
  topLabel: string | null;
  bottomLabel: string | null;
}

export interface ImageCompareContent {
  topImageUrl: string | null;
  topImageAlt: string | null;
  bottomImageUrl: string | null;
  bottomImageAlt: string | null;
  /** 0–100 */
  initialPercent: number;
  settings: ImageCompareSettings;
}

export function getDefaultImageCompareContent(): ImageCompareContent {
  return {
    topImageUrl: null,
    topImageAlt: null,
    bottomImageUrl: null,
    bottomImageAlt: null,
    initialPercent: 50,
    settings: {
      showLabels: true,
      topLabel: "Before",
      bottomLabel: "After",
    },
  };
}


