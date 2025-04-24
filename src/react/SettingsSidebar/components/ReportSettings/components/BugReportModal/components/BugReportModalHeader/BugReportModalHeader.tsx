import type { FC } from "react";

import React from "react";
import CrossIcon from "@atlaskit/icon/glyph/cross";
import { IconButton } from "@atlaskit/button/new";
import { ModalTitle } from "@atlaskit/modal-dialog";

interface BugReportModalHeaderProps {
  onClose: () => void;
}

const BugReportModalHeader: FC<BugReportModalHeaderProps> = ({ onClose }) => {
  return (
    <div className="w-full flex justify-between">
      <ModalTitle>
        <h1 className="text-xl mb-4">Report a bug</h1>
      </ModalTitle>
      <IconButton appearance="subtle" icon={CrossIcon} label="Close Modal" onClick={onClose} />
    </div>
  );
};

export default BugReportModalHeader;
