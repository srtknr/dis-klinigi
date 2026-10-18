"use client";

import { useEffect, useRef, useState } from "react";
import { getStaffAvailabilityAction } from "@/features/appointments/actions";

export type StaffSlotsState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; slots: { time: string }[]; closedReason: string | null; slotMinutes: number; externalUnavailable: boolean };

/** Panel için seçilen doktor + gün uygunluğunu sunucudan getirir. `reloadKey` değişince yeniden yükler. */
export function useStaffSlots(dentistId: string, date: string, excludeAppointmentId?: string, reloadKey = 0): StaffSlotsState {
  const [state, setState] = useState<StaffSlotsState>({ status: "idle" });
  const seq = useRef(0);

  useEffect(() => {
    if (!dentistId || !date) return;
    const current = ++seq.current;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setState({ status: "loading" });
    });
    getStaffAvailabilityAction({ dentistId, date, excludeAppointmentId })
      .then((result) => {
        if (cancelled || current !== seq.current) return;
        if (!result.ok) setState({ status: "error", message: result.error });
        else
          setState({
            status: "ready",
            slots: result.data.slots.map((s) => ({ time: s.time })),
            closedReason: result.data.closedReason,
            slotMinutes: result.data.slotMinutes,
            externalUnavailable: result.data.externalCalendar === "unavailable",
          });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error", message: "Müsait saatler yüklenemedi." });
      });
    return () => {
      cancelled = true;
    };
  }, [dentistId, date, excludeAppointmentId, reloadKey]);

  return dentistId && date ? state : { status: "idle" };
}
