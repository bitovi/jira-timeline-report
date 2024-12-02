export const isValidChange = (event: any): event is { value: string } => {
  return "value" in event;
};

export const isValidSubmit = (event: any): event is { name: { value: string } } => {
  return "name" in event && "value" in event?.name;
};
