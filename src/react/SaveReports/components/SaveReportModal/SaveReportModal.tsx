import type { FC } from 'react';

import React, { useState } from 'react';
import Button, { IconButton } from '@atlaskit/button/new';
import Modal, { ModalBody, ModalFooter, ModalHeader, ModalTitle, ModalTransition } from '@atlaskit/modal-dialog';
import { Flex, Grid, xcss } from '@atlaskit/primitives';
import { ErrorMessage, Field } from '@atlaskit/form';
import Textfield from '@atlaskit/textfield';
import Spinner from '@atlaskit/spinner';
import CrossIcon from '@atlaskit/icon/glyph/cross';

import { isValidChange, isValidSubmit } from './utilities';

const gridStyles = xcss({
  width: '100%',
});

const closeContainerStyles = xcss({
  gridArea: 'close',
});

const titleContainerStyles = xcss({
  gridArea: 'title',
});

interface SaveReportModalProps {
  validate: (name: string) => { isValid: boolean; message: string };
  onCreate: (name: string) => void;
  closeModal: () => void;
  isOpen: boolean;
  isCreating: boolean;
  name: string;
  setName: (newName: string) => void;
  autoFocus?: boolean;
}

const SaveReportModal: FC<SaveReportModalProps> = ({
  isOpen,
  closeModal,
  name: nameProp,
  onCreate,
  validate,
  isCreating,
  autoFocus = true,
}) => {
  const [errorMessage, setErrorMessage] = useState('');
  const handleSubmit = (name: string) => {
    onCreate(name);
  };

  return (
    <ModalTransition>
      {isOpen && (
        <Modal onClose={closeModal}>
          <form
            onSubmit={(event) => {
              event.preventDefault();

              if (isValidSubmit(event.target)) {
                handleSubmit(event.target.name.value);
              }
            }}
          >
            <ModalHeader>
              <Grid gap="space.200" templateAreas={['title close']} xcss={gridStyles}>
                <Flex xcss={closeContainerStyles} justifyContent="end">
                  <IconButton appearance="subtle" icon={CrossIcon} label="Close Modal" onClick={closeModal} />
                </Flex>
                <Flex xcss={titleContainerStyles} justifyContent="start">
                  <ModalTitle>Save Report</ModalTitle>
                </Flex>
              </Grid>
            </ModalHeader>
            <ModalBody>
              <Field name="name" label="Name" isRequired>
                {({ fieldProps }) => {
                  const handleChange = (value: string) => {
                    const { message } = validate(value);

                    setErrorMessage(message);
                    fieldProps.onChange(value);
                  };

                  const handleBlur = (value: string) => {
                    setErrorMessage('');

                    const { isValid, message } = validate(value);

                    if (isValid) {
                      return;
                    }

                    setErrorMessage(message);
                  };

                  return (
                    <>
                      <Textfield
                        defaultValue={nameProp}
                        autoFocus={autoFocus}
                        {...fieldProps}
                        onChange={(event) => {
                          // types for this textfield are coming from ADS as a FORMEVENT
                          if (!isValidChange(event.target)) {
                            return;
                          }
                          handleChange(event.target.value);
                        }}
                        onBlur={(event) => {
                          handleBlur(event.target.value);
                        }}
                        onFocus={(e) => e.target.select()}
                      />
                      {!!errorMessage && <ErrorMessage>{errorMessage}</ErrorMessage>}
                    </>
                  );
                }}
              </Field>
            </ModalBody>
            <ModalFooter>
              <Button isDisabled={!!isCreating} appearance="subtle" onClick={closeModal}>
                Cancel
              </Button>
              <Button isDisabled={!!errorMessage || isCreating} type="submit" appearance="primary">
                {isCreating ? <Spinner /> : 'Confirm'}
              </Button>
            </ModalFooter>
          </form>
        </Modal>
      )}
    </ModalTransition>
  );
};

export default SaveReportModal;
