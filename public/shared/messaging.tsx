import React from "react";
import SuccessIcon from "@atlaskit/icon/core/success";
import ErrorIcon from "@atlaskit/icon/core/error";
import { Text } from "@atlaskit/primitives";
import { token } from "@atlaskit/tokens";

export const errorIcon = <ErrorIcon color={token("color.icon.danger")} label="error" />;
export const successIcon = <SuccessIcon color={token("color.icon.success")} label="success" />;

export const errorHeader = (msg = "Uh Oh!") => <Text color="color.text.danger">{msg}</Text>;
export const successHeader = (msg = "Success") => <Text color="color.text.success">{msg}</Text>;
