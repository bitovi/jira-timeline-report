import { LinkBuilderFactory } from './common';

export const createWebLinkBuilder: LinkBuilderFactory = () => {
  return (queryParams) => queryParams;
};
