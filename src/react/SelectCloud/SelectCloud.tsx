import type { FC } from 'react';
import type { CanObservable } from '../hooks/useCanObservable';
import type { Resource } from './SelectCloudView';

import React, { useMemo } from 'react';

import { useQuery } from '@tanstack/react-query';

import { useJira } from '../services/jira';
import { useCanObservable } from '../hooks/useCanObservable';
import SelectCloudView from './SelectCloudView';

interface SelectCloudProps {
  // Passed in (like LoginButton's observables) so the wrapper supplies
  // routeData.isLoggedInObservable and tests can supply a fake.
  isLoggedInObservable: CanObservable<boolean>;
}

/**
 * Container for the site picker: fetches the accessible Jira sites (gated on
 * login), derives the current vs. alternate sites from `scopeId`, and switches
 * sites via a hard reload — behaviour-preserving from the old StacheElement.
 */
const SelectCloud: FC<SelectCloudProps> = ({ isLoggedInObservable }) => {
  const jira = useJira();
  const isLoggedIn = useCanObservable(isLoggedInObservable);

  const { data: resources = [], isLoading } = useQuery({
    queryKey: ['accessible-resources'],
    // The accessible-resources endpoint resolves to a raw array of sites; the
    // shared RequestHelper type is looser than reality, hence the cast.
    queryFn: () => jira.fetchAccessibleResources() as unknown as Promise<Resource[]>,
    enabled: isLoggedIn, // gate = old `canQuery`
  });

  const scopeId = localStorage.getItem('scopeId');
  const current = useMemo(() => resources.find((resource) => resource.id === scopeId), [resources, scopeId]);
  const alternates = useMemo(() => resources.filter((resource) => resource.id !== scopeId), [resources, scopeId]);

  const onSelectCloud = (id: string) => {
    localStorage.setItem('scopeId', id);
    window.location.reload();
  };

  return (
    <SelectCloudView
      isLoading={isLoading && isLoggedIn}
      current={current}
      alternates={alternates}
      onSelectCloud={onSelectCloud}
    />
  );
};

export default SelectCloud;
