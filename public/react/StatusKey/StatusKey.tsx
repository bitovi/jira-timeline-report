import { FC } from "react";

import React from "react";
import Lozenge from "@atlaskit/lozenge";
import { useTheme } from "../services/theme";

const StatusKey: FC = () => {
  const theme = useTheme();

  return (
    <div>
      {theme.map(({ backgroundCssVar, textCssVar, label }) => (
        <Lozenge
          style={{
            backgroundColor: `var(${backgroundCssVar})`,
            color: `var(${textCssVar})`,
          }}
        >
          {label}
        </Lozenge>
      ))}
    </div>
  );
};

export default StatusKey;
