import type { IsoDate } from "@/domain/types";

export const workoutHref = (date: IsoDate) => `/workout?date=${date}`;
