import { motion } from "framer-motion";
import type { FormEvent } from "react";
import { AvenLogo } from "../branding/AvenLogo";

export function AuthScreen({
  username,
  password,
  setUsername,
  setPassword,
  onSubmit,
}: {
  username: string;
  password: string;
  setUsername: (value: string) => void;
  setPassword: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <motion.div
      className="auth-screen relative z-10 grid min-h-[calc(100vh-56px)] place-items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.48, ease: [0.22, 0.61, 0.36, 1] }}
    >
      <motion.div
        className="auth-card w-[min(520px,calc(100vw-32px))] rounded-[28px] border border-white/40 bg-white/12 px-7.5 pb-5.5 pt-7 shadow-[0_24px_60px_rgba(108,93,158,0.13)] backdrop-blur-[18px] max-[760px]:px-5"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <div className="auth-logo-wrap mb-3 flex justify-center">
          <AvenLogo size="small" layoutId="aven-primary-lotus" />
        </div>

        <h1 className="m-0 text-center text-[clamp(2rem,2.6vw,2.6rem)] font-light leading-tight text-[rgba(30,32,44,0.9)]">
          Welcome to Aven
        </h1>
        <p className="auth-description mx-auto mb-5.5 mt-2.5 text-center text-base font-light text-[rgba(52,56,78,0.72)]">
          Your life, your goals, your possibilities.
        </p>

        <form className="auth-form grid gap-3.5" onSubmit={onSubmit}>
          <label className="relative">
            <span className="sr-only">Username</span>
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Username"
              aria-label="Username"
              className="w-full rounded-[14px] border border-white/50 bg-white/12 px-3.5 py-3.75 text-base font-light text-[rgba(31,33,47,0.93)] placeholder:text-[rgba(59,62,84,0.66)] focus:border-[rgba(188,174,255,0.9)] focus:outline-none focus:shadow-[0_0_0_4px_rgba(166,157,255,0.16)]"
            />
          </label>

          <label className="relative">
            <span className="sr-only">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              aria-label="Password"
              className="w-full rounded-[14px] border border-white/50 bg-white/12 px-3.5 py-3.75 text-base font-light text-[rgba(31,33,47,0.93)] placeholder:text-[rgba(59,62,84,0.66)] focus:border-[rgba(188,174,255,0.9)] focus:outline-none focus:shadow-[0_0_0_4px_rgba(166,157,255,0.16)]"
            />
          </label>

          <button
            type="submit"
            className="auth-submit mt-2.5 cursor-pointer rounded-2xl border border-white/40 bg-[linear-gradient(135deg,rgba(255,255,255,0.32),rgba(210,214,255,0.22))] px-4.5 py-3.5 text-base font-light text-[rgba(27,29,42,0.88)] shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_10px_18px_rgba(142,126,205,0.1)]"
          >
            Sign In
          </button>
        </form>

        <div className="auth-links mt-4.5 flex flex-wrap justify-center gap-4.5">
          <button
            type="button"
            className="cursor-pointer bg-transparent font-light text-[rgba(59,63,86,0.74)]"
          >
            Forgot password?
          </button>
          <button
            type="button"
            className="cursor-pointer bg-transparent font-light text-[rgba(59,63,86,0.74)]"
          >
            Create account
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
