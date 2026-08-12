import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ReportControls from './ReportControls';

const COPY_TEXT = 'Copy report';
const SAVE_CHANGES_TEXT = 'Save changes';
const SAVE_NEW_TEXT = 'Save new report';
const RESET_TEXT = 'Reset changes';
const DETACH_TEXT = 'Detach';

/**
 * By the icon's label rather than by the word "Report", which several of the menu items also
 * contain.
 */
const TRIGGER_LABEL = /open report options/i;

/** Every action lives behind the menu, so the tests have to open it first. */
const openMenu = () => userEvent.click(screen.getByRole('button', { name: TRIGGER_LABEL }));

it('should show nothing if no report is selected', () => {
  render(<ReportControls hasSelectedReport={false} />);

  expect(screen.queryByRole('button', { name: TRIGGER_LABEL })).not.toBeInTheDocument();
  expect(screen.queryByText(RESET_TEXT)).not.toBeInTheDocument();
});

it('should offer copy and detach, but not save changes, if not dirty', async () => {
  render(<ReportControls hasSelectedReport={true} isDirty={false} />);
  await openMenu();

  expect(screen.queryByText(COPY_TEXT)).toBeInTheDocument();
  expect(screen.queryByText(DETACH_TEXT)).toBeInTheDocument();
  expect(screen.queryByText(SAVE_CHANGES_TEXT)).not.toBeInTheDocument();
});

// "Copy report" would be a lie once there are edits: what gets saved is what's on screen, which the
// original report doesn't have.
it('should offer save changes and save new report, but not copy, if dirty', async () => {
  render(<ReportControls hasSelectedReport={true} isDirty={true} />);
  await openMenu();

  expect(screen.queryByText(SAVE_CHANGES_TEXT)).toBeInTheDocument();
  expect(screen.queryByText(SAVE_NEW_TEXT)).toBeInTheDocument();
  expect(screen.queryByText(COPY_TEXT)).not.toBeInTheDocument();
});

it('should offer reset changes only if dirty', async () => {
  const { unmount } = render(<ReportControls hasSelectedReport={true} isDirty={false} />);
  await openMenu();
  expect(screen.queryByText(RESET_TEXT)).not.toBeInTheDocument();
  unmount();

  render(<ReportControls hasSelectedReport={true} isDirty={true} />);
  await openMenu();
  expect(screen.queryByText(RESET_TEXT)).toBeInTheDocument();
});

it('should reset when the reset item is clicked', async () => {
  const resetChanges = vi.fn();
  render(<ReportControls hasSelectedReport={true} isDirty={true} resetChanges={resetChanges} />);
  await openMenu();

  await userEvent.click(screen.getByText(RESET_TEXT));

  expect(resetChanges).toHaveBeenCalled();
});

// Detaching is about the link to the saved report, not about the settings on top of it, so it is
// offered whether or not there are unsaved changes.
it.each([false, true])('should detach when the detach item is clicked and dirty is %s', async (isDirty) => {
  const detachReport = vi.fn();
  render(<ReportControls hasSelectedReport={true} isDirty={isDirty} detachReport={detachReport} />);
  await openMenu();

  await userEvent.click(screen.getByText(DETACH_TEXT));

  expect(detachReport).toHaveBeenCalled();
});

it('should open the save modal from both names for it', async () => {
  const openModal = vi.fn();
  const { unmount } = render(<ReportControls hasSelectedReport={true} isDirty={false} openModal={openModal} />);
  await openMenu();
  await userEvent.click(screen.getByText(COPY_TEXT));
  unmount();

  render(<ReportControls hasSelectedReport={true} isDirty={true} openModal={openModal} />);
  await openMenu();
  await userEvent.click(screen.getByText(SAVE_NEW_TEXT));

  expect(openModal).toHaveBeenCalledTimes(2);
});
