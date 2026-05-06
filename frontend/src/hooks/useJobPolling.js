import { useEffect, useRef, useState } from "react";
import { jobs } from "../api/client";

const INTERVAL_MS = 3000;

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

    setState({ status: null, progress: 0, message: "", result: null, error: null });

    const poll = async () => {
      try {
        const { data } = await jobs.status(jobId);

        if (data.status === "done") {
          clearInterval(intervalRef.current);
          // result comes inline from GET /jobs/{id} when done
          const result = data.result ?? (await jobs.result(jobId).then((r) => r.data));
          setState({ status: "done", progress: 100, message: "Concluído.", result, error: null });
        } else if (data.status === "error") {
          clearInterval(intervalRef.current);
          setState((prev) => ({
            ...prev,
            status: "error",
            error: data.error ?? data.message ?? "Erro no processamento.",
          }));
        } else {
          setState((prev) => ({
            ...prev,
            status: data.status,
            progress: data.progress ?? prev.progress,
            message: data.message ?? "",
          }));
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
