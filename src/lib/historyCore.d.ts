export interface HistoryPoint { t: number; s: number }
export declare const MAX_HISTORY_POINTS: number;
export declare function appendStarPoint(history: HistoryPoint[] | undefined, stars: number, at?: number): HistoryPoint[];
