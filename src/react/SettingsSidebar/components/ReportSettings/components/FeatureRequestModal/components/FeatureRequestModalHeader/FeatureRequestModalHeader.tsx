import type { FC } from 'react';

import React from 'react';
import CrossIcon from '@atlaskit/icon/glyph/cross';
import { IconButton } from '@atlaskit/button/new';
import { ModalTitle } from '@atlaskit/modal-dialog';

interface FeatureRequestModalHeaderProps {
  onClose: () => void;
}

const FeatureRequestModalHeader: FC<FeatureRequestModalHeaderProps> = ({ onClose }) => {
  return (
    <div className="w-full flex justify-between">
      <div>
        <ModalTitle>
          <h1 className="text-xl mb-4">Feature Request</h1>
        </ModalTitle>

        <p className="text-sm">
          We want to support the kinds of reports you actually need. Tell us what you're trying to build — the more
          detail, the better.
        </p>

        <p className="pt-4 text-sm">If it helps explain the report you're after, you can upload one or more images.</p>
      </div>
      <IconButton appearance="subtle" icon={CrossIcon} label="Close Modal" onClick={onClose} />
    </div>
  );
};

export default FeatureRequestModalHeader;
