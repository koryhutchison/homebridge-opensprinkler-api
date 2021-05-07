export interface ValveConfig {
  name: string;
  defaultDuration: number;
}

export interface ValveStatuses {
  [name: string]: ValveStatus;
}

interface ValveStatus {
  isActive: boolean;
  remainingDuration: number;
}
