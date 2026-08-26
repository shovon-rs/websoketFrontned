"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

type PasswordFieldProps = {
	name?: string;
	placeholder?: string;
	minLength?: number;
	required?: boolean;
	autoComplete?: "current-password" | "new-password";
};

export function PasswordField({
	name = "password",
	placeholder,
	minLength,
	required,
	autoComplete,
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
