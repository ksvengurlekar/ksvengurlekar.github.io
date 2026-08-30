export const YTTL = 3;

export const cookie_ops = {
    maxAge: 1000 * 60 * 60 * 24 * 365 * YTTL,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
};
