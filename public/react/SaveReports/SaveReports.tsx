import type { ComponentProps, ComponentPropsWithRef, FC } from "react";

import React, { forwardRef, Suspense, useCallback, useState } from "react";
import Link from "@atlaskit/link";
import Button, { IconButton } from "@atlaskit/button/new";
import { v4 as uuidv4 } from "uuid";

import Modal, { ModalBody, ModalFooter, ModalHeader, ModalTitle, ModalTransition } from "@atlaskit/modal-dialog";
import { Flex, Grid, xcss } from "@atlaskit/primitives";

import CrossIcon from "@atlaskit/icon/glyph/cross";
import { ErrorMessage, Field } from "@atlaskit/form";
import Textfield from "@atlaskit/textfield";
import { StorageProvider } from "../services/storage";
import { AppStorage } from "../../jira/storage/common";
import { useAllReports } from "./services/reports/useAllReports";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useCreateReport } from "./services/reports/useSaveReports";
import { FlagsProvider } from "@atlaskit/flag";
import Heading from "@atlaskit/heading";
import SectionMessage from "@atlaskit/section-message";
import { ErrorBoundary } from "react-error-boundary";
import Skeleton from "../components/Skeleton";
import LinkButton from "../components/LinkButton";
import Spinner from "@atlaskit/spinner";
import DropdownMenu, { DropdownItem, DropdownItemGroup } from "@atlaskit/dropdown-menu";
import { useRecentReports } from "./services/reports/useRecentReports";
import Hr from "../components/Hr";

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
  const { recentReports, addReportToRecents } = useRecentReports();

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

  console.log({ recentReports });

  const { createReport, isCreating } = useCreateReport();

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
        <DropdownMenu trigger="Saved Reports" shouldRenderToParent>
          {recentReports?.length === 0 ? (
            <DropdownItemGroup>
              <div className="max-w-64 flex flex-col items-center gap-4 p-4 text-center">
                <img src="/assets/no-reports.png" />
                <p className="text-xl font-semibold">You don't have any saved reports</p>
                <p className="text-sm">When you save your first report, you will be able to access it here.</p>
              </div>
            </DropdownItemGroup>
          ) : (
            <>
              <DropdownItemGroup>
                <p className="p-4 text-xs text-slate-400 font-semibold uppercase">Recent</p>
                {recentReports.map((reportId) => {
                  const matched = Object.values(reports).find((report) => report?.id === reportId);

                  if (!matched) {
                    return null;
                  }

                  return (
                    <DropdownItem
                      key={reportId}
                      onClick={(event) => {
                        event.stopPropagation();
                        window.location.search = "?" + matched.queryParams;
                      }}
                    >
                      Report name {matched.name}
                    </DropdownItem>
                  );
                })}
              </DropdownItemGroup>
              <Hr className="!my-1" />
              <DropdownItemGroup>
                <DropdownItem>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      onViewReportsButtonClicked();
                    }}
                  >
                    View all saved reports
                  </button>
                </DropdownItem>
              </DropdownItemGroup>
            </>
          )}
        </DropdownMenu>
      </div>
      <SaveReportModal
        isOpen={isOpen}
        isCreating={isCreating}
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
          const id = uuidv4();

          createReport(
            { id, name, queryParams: window.location.search },
            {
              onSuccess: (_, variables) => {
                closeModal();
                addReportToRecents(id);
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
                        const { message } = validate(casted.value);

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
