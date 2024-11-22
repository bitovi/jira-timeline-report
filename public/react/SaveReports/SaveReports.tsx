import type { FC } from "react";

import React, { Suspense, useCallback, useState } from "react";
import Link from "@atlaskit/link";
import Button, { IconButton } from "@atlaskit/button/new";

import Modal, { ModalBody, ModalFooter, ModalHeader, ModalTitle, ModalTransition } from "@atlaskit/modal-dialog";
import { Flex, Grid, xcss } from "@atlaskit/primitives";

import CrossIcon from "@atlaskit/icon/glyph/cross";
import { ErrorMessage, Field, HelperMessage } from "@atlaskit/form";
import Textfield from "@atlaskit/textfield";
import Form from "@atlaskit/form";
import { StorageProvider } from "../services/storage";
import { AppStorage } from "../../jira/storage/common";
import { useAllReports } from "./services/reports/useAllReports";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useCreateReport } from "./services/reports/useSaveReports";
import { FlagsProvider } from "@atlaskit/flag";
import Heading from "@atlaskit/heading";
import ViewReports from "../ViewReports/ViewReports";
import SectionMessage from "@atlaskit/section-message";
import { ErrorBoundary } from "react-error-boundary";
import Skeleton from "../components/Skeleton";
import LinkButton from "../components/LinkButton";

const gridStyles = xcss({
  width: "100%",
});

const closeContainerStyles = xcss({
  gridArea: "close",
});

const titleContainerStyles = xcss({
  gridArea: "title",
});

interface SaveReportProps {
  onViewReportsButtonClicked: () => void;
}

const SaveReport: FC<SaveReportProps> = ({ onViewReportsButtonClicked }) => {
  const [isOpen, setIsOpen] = useState(false);
  const openModal = () => setIsOpen(true);
  const closeModal = () => setIsOpen(false);
  const reports = useAllReports();

  const [name, setName] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const selectedReport = params.get("report");

    if (!selectedReport) {
      return "Untitled Report";
    }

    return (
      Object.values(reports)
        .filter((r) => !!r)
        .find(({ id }) => id === selectedReport)?.name || "Untitled Report"
    );
  });

  // throw new Error("lol");

  const { createReport } = useCreateReport();

  return (
    <div className="flex gap-1 justify-between items-center">
      <div className="flex gap-3 items-center">
        {name && <Heading size="xlarge">{name}</Heading>}
        <LinkButton onClick={openModal}>Save Report</LinkButton>
      </div>
      <div>
        <Button
          appearance="subtle"
          onClick={(event) => {
            event.stopPropagation();

            onViewReportsButtonClicked();
          }}
        >
          Saved reports
        </Button>
      </div>
      <SaveReportModal
        isOpen={isOpen}
        closeModal={closeModal}
        validate={(name) => {
          const match = Object.values(reports).find((report) => report?.name === name);

          return {
            isValid: !match,
            message: !match ? "" : "That name already exists. Please input a unique report name.",
          };
        }}
        name={name}
        setName={setName}
        onCreate={(name: string) => {
          createReport(
            { name, queryParams: window.location.search },
            {
              onSuccess: () => {
                closeModal();
              },
            }
          );
        }}
      />
    </div>
  );
};

const queryClient = new QueryClient();

export default function ({
  storage,
  ...saveReportProps
}: {
  storage: AppStorage;
  onViewReportsButtonClicked: () => void;
}) {
  return (
    <ErrorBoundary
      fallbackRender={({ error }) => (
        <SectionMessage title="Cannot connect to app data" appearance="error">
          There is an issue communicating with Jira. We're unable to load or save reports. Please try again later.
        </SectionMessage>
      )}
    >
      <StorageProvider storage={storage}>
        <FlagsProvider>
          <Suspense fallback={<Skeleton height="32px" />}>
            <QueryClientProvider client={queryClient}>
              <SaveReport {...saveReportProps} />
            </QueryClientProvider>
          </Suspense>
        </FlagsProvider>
      </StorageProvider>
    </ErrorBoundary>
  );
}

interface SaveReportModalProps {
  validate: (name: string) => { isValid: boolean; message: string };
  onCreate: (name: string) => void;
  closeModal: () => void;
  isOpen: boolean;
  name: string;
  setName: (newName: string) => void;
}

const SaveReportModal: FC<SaveReportModalProps> = ({ isOpen, closeModal, name: nameProp, onCreate, validate }) => {
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
                    <Textfield
                      defaultValue={nameProp}
                      {...fieldProps}
                      onChange={(event) => {
                        const casted = event.target as any as { value: string };
                        const { isValid, message } = validate(casted.value);

                        setErrorMessage(message);

                        fieldProps.onChange(event);
                      }}
                      onBlur={(e) => {
                        setErrorMessage("");

                        const name = e.target.value;
                        const { isValid, message } = validate(name);

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
              <Button appearance="subtle" onClick={closeModal}>
                Cancel
              </Button>
              <Button isDisabled={!!errorMessage} type="submit" appearance="primary">
                Confirm
              </Button>
            </ModalFooter>
          </form>
        </Modal>
      )}
    </ModalTransition>
  );
};
