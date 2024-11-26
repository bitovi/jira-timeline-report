import type { FC } from "react";

import React, { useState } from "react";
import Button, { IconButton } from "@atlaskit/button/new";
import Modal, { ModalBody, ModalFooter, ModalHeader, ModalTitle, ModalTransition } from "@atlaskit/modal-dialog";
import { Flex, Grid, xcss } from "@atlaskit/primitives";
import { ErrorMessage, Field } from "@atlaskit/form";
import Textfield from "@atlaskit/textfield";
import Spinner from "@atlaskit/spinner";
import CrossIcon from "@atlaskit/icon/glyph/cross";

const gridStyles = xcss({
  width: "100%",
});

const closeContainerStyles = xcss({
  gridArea: "close",
});

const titleContainerStyles = xcss({
  gridArea: "title",
});

interface SaveReportModalProps {
  validate: (name: string) => { isValid: boolean; message: string };
  onCreate: (name: string) => void;
  closeModal: () => void;
  isOpen: boolean;
  isCreating: boolean;
  name: string;
  setName: (newName: string) => void;
}

const SaveReportModal: FC<SaveReportModalProps> = ({
  isOpen,
  closeModal,
  name: nameProp,
  onCreate,
  validate,
  isCreating,
}) => {
  const [errorMessage, setErrorMessage] = useState("");
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
              <Grid gap="space.200" templateAreas={["title close"]} xcss={gridStyles}>
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
                {({ fieldProps }) => (
                  <>
                    <Textfield
                      defaultValue={nameProp}
                      {...fieldProps}
                      onChange={(event) => {
                        if (!isValidChange(event.target)) {
                          return;
                        }

                        const { message } = validate(event.target.value);

                        setErrorMessage(message);

                        fieldProps.onChange(event);
                      }}
                      onBlur={(event) => {
                        setErrorMessage("");

                        const { isValid, message } = validate(event.target.value);

                        if (isValid) {
                          return;
                        }

                        setErrorMessage(message);
                      }}
                    />
                    {!!errorMessage && <ErrorMessage>{errorMessage}</ErrorMessage>}
                  </>
                )}
              </Field>
            </ModalBody>
            <ModalFooter>
              <Button isDisabled={!!isCreating} appearance="subtle" onClick={closeModal}>
                Cancel
              </Button>
              <Button isDisabled={!!errorMessage || isCreating} type="submit" appearance="primary">
                {isCreating ? <Spinner /> : "Confirm"}
              </Button>
            </ModalFooter>
          </form>
        </Modal>
      )}
    </ModalTransition>
  );
};

export default SaveReportModal;

const isValidChange = (event: any): event is { value: string } => {
  return "value" in event;
};

const isValidSubmit = (event: any): event is { name: { value: string } } => {
  return "name" in event && "value" in event?.name;
};
