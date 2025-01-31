import React from "react";

interface GoBackButtonProps {
  hideSettings: () => void;
}

export const GoBackButton: React.FC<GoBackButtonProps> = ({ hideSettings }) => (
<button className="block p-2 text-sm text-slate-300 hover:bg-blue-50  w-full text-left"
  onClick={hideSettings}>
  <img src="/images/go-back.svg" className="inline"/> Go back</button>
);

export default GoBackButton;
