"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

type PasswordFieldProps = {
	name?: string;
	placeholder?: string;
	minLength?: number;
	required?: boolean;
	autoComplete?: "current-password" | "new-password";
	/** Optional — lets a caller (e.g. a password-strength meter) observe the live value without
	 * turning this into a controlled input. */
	onChange?: (value: string) => void;
};

export function PasswordField({
	name = "password",
	placeholder,
	minLength,
	required,
	autoComplete,
	onChange,
}: PasswordFieldProps) {
	const [visible, setVisible] = useState(false);
	const label = visible ? "Hide password" : "Show password";

	return (
		<div className="password-field">
			<input
				name={name}
				type={visible ? "text" : "password"}
				placeholder={placeholder}
				minLength={minLength}
				required={required}
				autoComplete={autoComplete}
				onChange={onChange ? (e) => onChange(e.target.value) : undefined}
			/>
			<button
				type="button"
				className="password-toggle"
				onClick={() => setVisible((current) => !current)}
				aria-label={label}
				aria-pressed={visible}
				title={label}
			>
				{visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
			</button>
		</div>
	);
}
