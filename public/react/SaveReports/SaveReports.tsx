import type { FC } from "react";

import React, { useCallback, useState } from "react";
import Link from "@atlaskit/link";
import Button, { IconButton } from "@atlaskit/button/new";

import Modal, { ModalBody, ModalFooter, ModalHeader, ModalTitle, ModalTransition } from "@atlaskit/modal-dialog";
import { Flex, Grid, xcss } from "@atlaskit/primitives";

import CrossIcon from "@atlaskit/icon/glyph/cross";
import { Field } from "@atlaskit/form";
import Textfield from "@atlaskit/textfield";
import Form from "@atlaskit/form";

const gridStyles = xcss({
  width: "100%",
});

const closeContainerStyles = xcss({
  gridArea: "close",
});

const titleContainerStyles = xcss({
  gridArea: "title",
});

interface SaveReportProps {}

const SaveReport: FC<SaveReportProps> = () => {
  const [isOpen, setIsOpen] = useState(false);
  const openModal = () => setIsOpen(true);
  const closeModal = () => setIsOpen(false);

  const [name, setName] = useState("pikachu");

  return (
    <div className="flex gap-1 justify-between items-center">
      <div className="flex gap-1 items-center">
        <p>{name}</p>
        <Button appearance="subtle" onClick={openModal}>
          Save Report
        </Button>
      </div>
      <div>
        <Button appearance="subtle">Saved reports</Button>
      </div>
      <SaveReportModal isOpen={isOpen} closeModal={closeModal} name={name} setName={setName} />
    </div>
  );
};

export default SaveReport;

interface SaveReportModalProps {
  closeModal: () => void;
  isOpen: boolean;
  name: string;
  setName: (newName: string) => void;
}

const SaveReportModal: FC<SaveReportModalProps> = ({ isOpen, closeModal, name: nameProp, setName }) => {
  const handleSubmit = (name: string) => {
    setName(name);

    closeModal();
  };

  return (
    <ModalTransition>
      {isOpen && (
        <Modal onClose={closeModal}>
          <form
            onSubmit={(event) => {
              event.preventDefault();

              const casted = event.target as any as { name: { value: string } };
              handleSubmit(casted.name.value);
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
                    <Textfield defaultValue={nameProp} {...fieldProps} />
                  </>
                )}
              </Field>
            </ModalBody>
            <ModalFooter>
              <Button appearance="subtle" onClick={closeModal}>
                Cancel
              </Button>
              <Button type="submit" appearance="primary">
                Confirm
              </Button>
            </ModalFooter>
          </form>
        </Modal>
      )}
    </ModalTransition>
  );
};
