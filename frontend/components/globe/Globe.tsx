"use client";

import dynamic from "next/dynamic";

const Globe = dynamic(() => import("react-globe.gl"), { ssr: false });

export default Globe;
export type { GlobeMethods } from "react-globe.gl";
