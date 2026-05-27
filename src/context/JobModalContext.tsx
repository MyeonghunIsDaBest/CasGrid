import { createContext, useContext, useState, useCallback } from 'react';

interface JobModalContextType {
  selectedJobId: string | null;
  openJob: (id: string) => void;
  closeJob: () => void;
}

const JobModalContext = createContext<JobModalContextType>({
  selectedJobId: null,
  openJob: () => {},
  closeJob: () => {},
});

export function JobModalProvider({ children }: { children: React.ReactNode }) {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const openJob = useCallback((id: string) => setSelectedJobId(id), []);
  const closeJob = useCallback(() => setSelectedJobId(null), []);

  return (
    <JobModalContext.Provider value={{ selectedJobId, openJob, closeJob }}>
      {children}
    </JobModalContext.Provider>
  );
}

export function useJobModal() {
  return useContext(JobModalContext);
}
