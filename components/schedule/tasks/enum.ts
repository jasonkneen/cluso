export enum EnumTodoPriority {
  High = "high",
  Medium = "medium",
  Low = "low"
}

export enum EnumTodoStatus {
  Pending = "pending",
  InProgress = "in-progress",
  Completed = "completed"
}

export const priorityClasses: Record<EnumTodoPriority, string> = {
  [EnumTodoPriority.High]: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  [EnumTodoPriority.Medium]:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  [EnumTodoPriority.Low]: "bg-gray-200 text-green-80 dark:bg-gray-700 dark:text-gray-200"
};

export const priorityDotColors: Record<EnumTodoPriority, string> = {
  [EnumTodoPriority.High]: "bg-red-500",
  [EnumTodoPriority.Medium]: "bg-yellow-500",
  [EnumTodoPriority.Low]: "bg-gray-400"
};

export const statusClasses: Record<EnumTodoStatus, string> = {
  [EnumTodoStatus.Pending]: "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200",
  [EnumTodoStatus.InProgress]:
    "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  [EnumTodoStatus.Completed]: "bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100"
};

export const todoStatusNamed: Record<EnumTodoStatus, string> = {
  [EnumTodoStatus.Pending]: "Pending",
  [EnumTodoStatus.InProgress]: "In Progress",
  [EnumTodoStatus.Completed]: "Completed"
};

export const statusDotColors: Record<EnumTodoStatus, string> = {
  [EnumTodoStatus.Pending]: "bg-blue-500",
  [EnumTodoStatus.InProgress]: "bg-purple-500",
  [EnumTodoStatus.Completed]: "bg-green-500"
};
