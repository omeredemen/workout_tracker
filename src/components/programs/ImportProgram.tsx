"use client";

import { useState } from "react";
import { parseProgram, type ProgramError } from "@/domain/parseProgram";
import type { Program } from "@/domain/types";
import { bundledLibrary } from "@/data/bundled";
import { button, card } from "@/components/ui/styles";

/** Paste or upload a program JSON; shows every validation problem, or hands back the parsed program. */
export function ImportProgram({
  onValid,
}: {
  onValid: (program: Program) => void;
}) {
  const [text, setText] = useState("");
  const [errors, setErrors] = useState<ProgramError[] | null>(null);

  function check(source: string) {
    let json: unknown;
    try {
      json = JSON.parse(source);
    } catch (e) {
      setErrors([
        {
          path: "",
          message: `Not valid JSON: ${e instanceof Error ? e.message : String(e)}`,
        },
      ]);
      return;
    }
    const result = parseProgram(json, bundledLibrary);
    if (result.ok) {
      setErrors(null);
      onValid(result.program);
    } else {
      setErrors(result.errors);
    }
  }

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    setText(content);
    check(content);
    e.target.value = "";
  }

  return (
    <section className={`${card} flex flex-col gap-3`}>
      <div>
        <h2 className="font-semibold">Import a program</h2>
        <p className="text-muted text-sm">
          Paste or upload a program JSON (see data/program.schema.json).
        </p>
      </div>
      <label className={`${button.secondary} w-full cursor-pointer`}>
        Upload .json file
        <input
          type="file"
          accept="application/json,.json"
          onChange={upload}
          className="sr-only"
        />
      </label>
      <textarea
        aria-label="Program JSON"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder='{ "schemaVersion": 1, "id": "my_program", … }'
        rows={6}
        spellCheck={false}
        className="border-border bg-background rounded-xl border p-3 font-mono text-xs"
      />
      <button
        type="button"
        className={button.secondary}
        disabled={!text.trim()}
        onClick={() => check(text)}
      >
        Check program
      </button>
      {errors && (
        <div
          role="alert"
          className="border-danger rounded-xl border p-3 text-sm"
        >
          <p className="text-danger font-semibold">
            {errors.length} problem{errors.length === 1 ? "" : "s"} to fix
          </p>
          <ul className="mt-2 flex max-h-72 flex-col gap-2 overflow-y-auto">
            {errors.map((e, i) => (
              <li key={i}>
                {e.path && (
                  <code className="text-muted block text-xs break-all">
                    {e.path}
                  </code>
                )}
                {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
