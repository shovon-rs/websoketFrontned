"use client";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { PasswordField } from "@/components/PasswordField";
import { PageShimmer, Shimmer } from "@/components/Shimmer";
import { ApiError } from "@/lib/api-client";
import * as usersApi from "@/lib/api/users.api";
import { useAuth } from "@/lib/auth-context";
import { strongPasswordError } from "@/lib/password";
import { Camera } from "lucide-react";
import { useRef, useState } from "react";

function initialsOf(name: string): string {
	const parts = name.trim().split(/\s+/);
	return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_BYTES = 5 * 1024 * 1024;

export default function Settings() {
	const { user, updateProfile, changePassword, setAvatarUrl } = useAuth();
	const [displayName, setDisplayName] = useState(user?.displayName ?? "");
	const [error, setError] = useState<string | null>(null);
	const [saved, setSaved] = useState(false);
	const [submitting, setSubmitting] = useState(false);

	const [passwordError, setPasswordError] = useState<string | null>(null);
	const [passwordSaved, setPasswordSaved] = useState(false);
	const [changingPassword, setChangingPassword] = useState(false);

	const [photoPreview, setPhotoPreview] = useState<string | null>(null);
	const [photoError, setPhotoError] = useState<string | null>(null);
	const [uploadingPhoto, setUploadingPhoto] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const objectUrlRef = useRef<string | null>(null);

	if (!user)
		return (
			<AppShell title="Settings">
				<PageShimmer />
			</AppShell>
		);

	const dirty = displayName.trim() !== user.displayName;

	async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setError(null);
		setSaved(false);

		const trimmed = displayName.trim();
		if (!trimmed) {
			setError("Full name can't be empty.");
			return;
		}

		setSubmitting(true);
		try {
			await updateProfile(trimmed);
			setSaved(true);
		} catch (err) {
			setError(
				err instanceof ApiError
					? err.message
					: "Could not save your changes. Please try again.",
			);
		} finally {
			setSubmitting(false);
		}
	}

	async function onChangePassword(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setPasswordError(null);
		setPasswordSaved(false);

		const form = new FormData(e.currentTarget);
		const oldPassword = String(form.get("oldPassword") ?? "");
		const newPassword = String(form.get("newPassword") ?? "");
		const confirmNewPassword = String(form.get("confirmNewPassword") ?? "");

		if (newPassword !== confirmNewPassword) {
			setPasswordError("New passwords do not match.");
			return;
		}
		const strengthError = strongPasswordError(newPassword);
		if (strengthError) {
			setPasswordError(strengthError);
			return;
		}

		setChangingPassword(true);
		try {
			await changePassword(oldPassword, newPassword);
			setPasswordSaved(true);
			e.currentTarget.reset();
		} catch (err) {
			setPasswordError(
				err instanceof ApiError
					? err.message
					: "Could not change your password. Please try again.",
			);
		} finally {
			setChangingPassword(false);
		}
	}

	async function onPhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		e.target.value = ""; // allow re-selecting the same file later
		if (!file) return;

		setPhotoError(null);

		if (!ALLOWED_TYPES.includes(file.type)) {
			setPhotoError("Please choose a JPEG, PNG, WEBP, or GIF image.");
			return;
		}
		if (file.size > MAX_BYTES) {
			setPhotoError("Image must be 5MB or smaller.");
			return;
		}

		if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
		const localPreview = URL.createObjectURL(file);
		objectUrlRef.current = localPreview;
		setPhotoPreview(localPreview);

		setUploadingPhoto(true);
		try {
			const avatarUrl = await usersApi.uploadAvatar(file);
			setAvatarUrl(avatarUrl);
		} catch (err) {
			setPhotoError(
				err instanceof ApiError
					? err.message
					: "Could not upload your photo. Please try again.",
			);
			setPhotoPreview(null);
		} finally {
			setUploadingPhoto(false);
		}
	}

	async function onRemovePhoto() {
		setPhotoError(null);
		setUploadingPhoto(true);
		try {
			await usersApi.removeAvatar();
			setAvatarUrl(null);
			setPhotoPreview(null);
		} catch (err) {
			setPhotoError(
				err instanceof ApiError
					? err.message
					: "Could not remove your photo. Please try again.",
			);
		} finally {
			setUploadingPhoto(false);
		}
	}

	const shownAvatarUrl = photoPreview ?? user.avatarUrl ?? null;

	return (
		<AppShell title="Settings" subtitle="Manage your profile information.">
			<div className="page narrow">
				<section className="card">
					<div className="card-head">
						<div style={{ display: "flex", alignItems: "center", gap: 14 }}>
							<div className="avatar-edit">
								<Avatar
									initials={initialsOf(user.displayName)}
									color="green"
									size="lg"
									src={shownAvatarUrl}
								/>
								<button
									type="button"
									onClick={() => fileInputRef.current?.click()}
									disabled={uploadingPhoto}
									title="Change photo"
								>
									<Camera size={13} />
								</button>
								<input
									ref={fileInputRef}
									type="file"
									accept={ALLOWED_TYPES.join(",")}
									onChange={onPhotoSelected}
								/>
							</div>
							<div>
								<h3 style={{ margin: 0 }}>{user.displayName}</h3>
								<p className="quiet">{user.email}</p>
								{shownAvatarUrl && !uploadingPhoto && (
									<button
										className="plain"
										style={{ padding: 0, marginTop: 4 }}
										onClick={onRemovePhoto}
									>
										Remove photo
									</button>
								)}
								{uploadingPhoto && <Shimmer className="shimmer-line short" />}
							</div>
						</div>
					</div>
					{photoError && <p className="auth-error">{photoError}</p>}

					<form className="settings-form" onSubmit={onSubmit}>
						<label>
							Email address
							<input value={user.email} disabled />
							<small>Your email address can't be changed.</small>
						</label>

						<label>
							Full name
							<input
								value={displayName}
								onChange={(e) => {
									setDisplayName(e.target.value);
									setSaved(false);
								}}
								maxLength={80}
								required
							/>
						</label>

						{user.createdAt && (
							<label>
								Member since
								<input
									value={new Date(user.createdAt).toLocaleDateString(
										undefined,
										{ year: "numeric", month: "long", day: "numeric" },
									)}
									disabled
								/>
							</label>
						)}

						{error && <p className="auth-error">{error}</p>}

						<div className="actions">
							<button className="primary" disabled={submitting || !dirty}>
								{submitting ? "Saving…" : "Save changes"}
							</button>
							{saved && !dirty && (
								<span className="save-confirmation">Saved</span>
							)}
						</div>
					</form>
				</section>

				<section className="card">
					<div className="card-head">
						<div>
							<h3>Password</h3>
							<p>Change your password by entering your current one.</p>
						</div>
					</div>

					<form className="settings-form" onSubmit={onChangePassword}>
						<label>
							Current password
							<PasswordField
								name="oldPassword"
								autoComplete="current-password"
								required
							/>
						</label>

						<label>
							New password
							<PasswordField
								name="newPassword"
								minLength={8}
								autoComplete="new-password"
								required
							/>
							<small>
								Must be 8+ characters with an uppercase letter, a lowercase
								letter, a number, and a special character.
							</small>
						</label>

						<label>
							Confirm new password
							<PasswordField
								name="confirmNewPassword"
								minLength={8}
								autoComplete="new-password"
								required
							/>
						</label>

						{passwordError && <p className="auth-error">{passwordError}</p>}

						<div className="actions">
							<button className="primary" disabled={changingPassword}>
								{changingPassword ? "Changing…" : "Change password"}
							</button>
							{passwordSaved && (
								<span className="save-confirmation">Saved</span>
							)}
						</div>
					</form>
				</section>
			</div>
		</AppShell>
	);
}
