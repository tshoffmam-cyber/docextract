import { useEffect, useRef, useState } from "react";
import { jobs } from "../api/client";

const TERMINAL = ["done", "error"];
const INTERVAL_MS = 2000;

export function useJobPolling(jobId) {
  const [state, setState] = useState({
    status: null,
    progress: 0,
    message: "",
    result: null,
    error: null,
  });
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!jobId) return;

    const poll = async () => {
      try {
        const { data } = await jobs.status(jobId);
        setState((prev) => ({
          ...prev,
          status: data.status,
          progress: data.progress,
          message: data.message,
        }));

        if (data.status === "done") {
          clearInterval(intervalRef.current);
          const { data: result } = await jobs.result(jobId);
          setState((prev) => ({ ...prev, result }));
        } else if (data.status === "error") {
          clearInterval(intervalRef.current);
          setState((prev) => ({ ...prev, error: data.message }));
        }
      } catch (err) {
        clearInterval(intervalRef.current);
        setState((prev) => ({ ...prev, error: "Erro ao consultar status do job." }));
      }
    };

    poll();
    intervalRef.current = setInterval(poll, INTERVAL_MS);
    return () => clearInterval(intervalRef.current);
  }, [jobId]);

  return state;
}
