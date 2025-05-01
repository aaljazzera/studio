'use client';

import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import type {PropsWithChildren} from 'react';
import * as React from 'react';

const QueryProvider = ({children}: PropsWithChildren) => {
  const [queryClient] = React.useState(() => new QueryClient());
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

export {QueryProvider};
