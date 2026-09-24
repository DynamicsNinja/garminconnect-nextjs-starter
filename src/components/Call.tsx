import styles from "./Call.module.css";

/**
 * The library call that produced the panel below it, printed with its real arguments and what came
 * back. This page is a demo of `garminconnect-js`, so the code is part of the content.
 */
export function Call(props: { method: string; args?: (string | number)[]; result: string; ms?: number | null }) {
  const args = props.args ?? [];
  return (
    <div className={styles.call}>
      <code>
        <span className={styles.kw}>await</span> garmin.<span className={styles.fn}>{props.method}</span>(
        {args.map((a, i) => (
          <span key={i}>
            {i > 0 && ", "}
            {typeof a === "number" ? a : <span className={styles.str}>&quot;{a}&quot;</span>}
          </span>
        ))}
        )
      </code>
      <span className={styles.result}>
        → {props.result}
        {props.ms != null && <> · {props.ms} ms</>}
      </span>
    </div>
  );
}
