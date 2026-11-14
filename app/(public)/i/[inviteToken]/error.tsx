"use client";

// WHY a re-export: an invite page that cannot read the link (a failed call, not an unknown link) needs
// the same "Something went wrong on our side." page as the signed-in app, and a public route is outside
// app/(app)/error.tsx. Nothing from the error is shown.
export { default } from "../../../(app)/error";
