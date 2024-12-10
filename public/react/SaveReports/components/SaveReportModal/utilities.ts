export const isValidChange = (event: any): event is { value: string } => {
  return !!event && typeof event === "object" && "value" in event;
};

export const isValidSubmit = (event: any): event is { name: { value: string } } => {
  return !!event && typeof event === "object" && "name" in event && "value" in event?.name;
};
