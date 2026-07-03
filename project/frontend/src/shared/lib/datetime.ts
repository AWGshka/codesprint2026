// All user-facing dates render in the campaign's home timezone (Europe/Malta),
// not the viewer's device timezone — donors and admins see the same clock.
const TIME_ZONE = "Europe/Malta";

const dateTimeFormat = new Intl.DateTimeFormat("en-MT", { dateStyle: "medium", timeStyle: "short", timeZone: TIME_ZONE });
const dateFormat = new Intl.DateTimeFormat("en-MT", { dateStyle: "medium", timeZone: TIME_ZONE });

export const formatDateTime = (value: string | number | Date): string => dateTimeFormat.format(new Date(value));

export const formatDate = (value: string | number | Date): string => dateFormat.format(new Date(value));
