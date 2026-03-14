import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActor } from "@/hooks/useActor";
import {
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LogOut,
  Plus,
  Shield,
  Trash2,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type AuthState = "checking" | "set-password" | "login" | "authenticated";

interface ApiKey {
  name: string;
  revealed: boolean;
  value: string | null;
}

export function AdminPanel({ onBack }: { onBack: () => void }) {
  const { actor, isFetching } = useActor();
  const [authState, setAuthState] = useState<AuthState>("checking");

  // Password gate state
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  // Key management state
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [keysLoading, setKeysLoading] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyValue, setNewKeyValue] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [showNewKeyValue, setShowNewKeyValue] = useState(false);

  // Check if password is set on mount
  useEffect(() => {
    if (!actor || isFetching) return;
    (async () => {
      try {
        const isSet = await actor.isAdminPasswordSet();
        setAuthState(isSet ? "login" : "set-password");
      } catch {
        setAuthState("set-password");
      }
    })();
  }, [actor, isFetching]);

  const loadKeys = useCallback(async () => {
    if (!actor) return;
    setKeysLoading(true);
    try {
      const names = await actor.listApiKeyNames();
      setKeys(
        names.map((name: string) => ({ name, revealed: false, value: null })),
      );
    } catch {
      toast.error("Failed to load API keys");
    } finally {
      setKeysLoading(false);
    }
  }, [actor]);

  useEffect(() => {
    if (authState === "authenticated") {
      loadKeys();
    }
  }, [authState, loadKeys]);

  async function handleSetPassword() {
    if (!actor) return;
    if (password.length < 6) {
      setAuthError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      setAuthError("Passwords do not match");
      return;
    }
    setAuthLoading(true);
    setAuthError("");
    try {
      await actor.setAdminPassword(password);
      setAuthState("authenticated");
      toast.success("Admin password set!");
    } catch {
      setAuthError("Failed to set password. Try again.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleLogin() {
    if (!actor) return;
    setAuthLoading(true);
    setAuthError("");
    try {
      const ok = await actor.verifyAdminPassword(password);
      if (ok) {
        setAuthState("authenticated");
        toast.success("Welcome back, Admin.");
      } else {
        setAuthError("Incorrect password");
      }
    } catch {
      setAuthError("Authentication failed. Try again.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleAddKey() {
    if (!actor) return;
    if (!newKeyName.trim() || !newKeyValue.trim()) {
      toast.error("Both key name and value are required");
      return;
    }
    setAddLoading(true);
    try {
      await actor.setApiKey(newKeyName.trim(), newKeyValue.trim());
      setNewKeyName("");
      setNewKeyValue("");
      setShowNewKeyValue(false);
      await loadKeys();
      toast.success(`Key "${newKeyName.trim()}" saved!`);
    } catch {
      toast.error("Failed to save API key");
    } finally {
      setAddLoading(false);
    }
  }

  async function handleDeleteKey(name: string) {
    if (!actor) return;
    try {
      await actor.deleteApiKey(name);
      await loadKeys();
      toast.success(`Key "${name}" deleted`);
    } catch {
      toast.error("Failed to delete key");
    }
  }

  async function handleRevealKey(name: string, index: number) {
    if (!actor) return;
    const key = keys[index];
    if (key.revealed) {
      setKeys((prev) =>
        prev.map((k, i) => (i === index ? { ...k, revealed: false } : k)),
      );
      return;
    }
    try {
      const result = (await actor.getApiKey(name)) as any;
      const value =
        Array.isArray(result) && result.length > 0
          ? (result[0] as string)
          : null;
      setKeys((prev) =>
        prev.map((k, i) => (i === index ? { ...k, revealed: true, value } : k)),
      );
    } catch {
      toast.error("Failed to reveal key");
    }
  }

  function handleLogout() {
    setAuthState("login");
    setPassword("");
    setConfirmPassword("");
    setKeys([]);
  }

  const isLoading = authState === "checking" || isFetching;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "oklch(0.09 0.02 235)" }}
    >
      {/* Header */}
      <header
        className="px-6 py-4 flex items-center justify-between border-b"
        style={{
          borderColor: "oklch(0.20 0.04 230 / 0.6)",
          background: "oklch(0.10 0.025 235 / 0.95)",
        }}
      >
        <button
          type="button"
          onClick={onBack}
          data-ocid="admin.link"
          className="flex items-center gap-2 text-sm transition-colors"
          style={{ color: "oklch(0.55 0.08 215)" }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to JARVIS
        </button>
        <div className="flex items-center gap-2">
          <Shield
            className="w-4 h-4"
            style={{ color: "oklch(0.65 0.18 210)" }}
          />
          <span
            className="text-sm font-mono font-semibold tracking-wider"
            style={{ color: "oklch(0.78 0.18 210)" }}
          >
            ADMIN PANEL
          </span>
        </div>
        {authState === "authenticated" && (
          <button
            type="button"
            onClick={handleLogout}
            data-ocid="admin.button"
            className="flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70"
            style={{ color: "oklch(0.55 0.06 230)" }}
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        )}
        {authState !== "authenticated" && <div className="w-20" />}
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <AnimatePresence mode="wait">
          {isLoading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              data-ocid="admin.loading_state"
              className="flex flex-col items-center gap-3"
            >
              <Loader2
                className="w-8 h-8 animate-spin"
                style={{ color: "oklch(0.65 0.18 210)" }}
              />
              <p
                className="text-sm font-mono"
                style={{ color: "oklch(0.45 0.05 230)" }}
              >
                Initializing secure channel...
              </p>
            </motion.div>
          )}

          {(authState === "set-password" || authState === "login") &&
            !isLoading && (
              <motion.div
                key="auth"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="w-full max-w-sm"
              >
                <Card
                  style={{
                    background: "oklch(0.12 0.025 235)",
                    border: "1px solid oklch(0.65 0.18 210 / 0.25)",
                    boxShadow: "0 0 40px oklch(0.65 0.18 210 / 0.08)",
                  }}
                >
                  <CardHeader className="pb-4">
                    <div className="flex justify-center mb-4">
                      <div
                        className="w-14 h-14 rounded-full flex items-center justify-center"
                        style={{
                          background: "oklch(0.65 0.18 210 / 0.1)",
                          border: "1px solid oklch(0.65 0.18 210 / 0.3)",
                          boxShadow: "0 0 20px oklch(0.65 0.18 210 / 0.15)",
                        }}
                      >
                        <KeyRound
                          className="w-6 h-6"
                          style={{ color: "oklch(0.78 0.18 210)" }}
                        />
                      </div>
                    </div>
                    <CardTitle
                      className="text-center text-base font-mono"
                      style={{ color: "oklch(0.85 0.06 220)" }}
                    >
                      {authState === "set-password"
                        ? "Set Admin Password"
                        : "Admin Access"}
                    </CardTitle>
                    <p
                      className="text-center text-xs font-mono mt-1"
                      style={{ color: "oklch(0.45 0.05 230)" }}
                    >
                      {authState === "set-password"
                        ? "Create a password to protect your API keys"
                        : "Enter your admin password to continue"}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                      <Label
                        className="text-xs font-mono"
                        style={{ color: "oklch(0.55 0.08 220)" }}
                      >
                        PASSWORD
                      </Label>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              authState === "set-password"
                                ? handleSetPassword()
                                : handleLogin();
                            }
                          }}
                          placeholder={
                            authState === "set-password"
                              ? "Create password"
                              : "Enter password"
                          }
                          data-ocid="admin.input"
                          className="pr-10 font-mono text-sm"
                          style={{
                            background: "oklch(0.09 0.02 235)",
                            borderColor: "oklch(0.25 0.04 230)",
                            color: "oklch(0.85 0.03 220)",
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100 transition-opacity"
                          style={{ color: "oklch(0.65 0.08 220)" }}
                        >
                          {showPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {authState === "set-password" && (
                      <div className="space-y-1.5">
                        <Label
                          className="text-xs font-mono"
                          style={{ color: "oklch(0.55 0.08 220)" }}
                        >
                          CONFIRM PASSWORD
                        </Label>
                        <Input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSetPassword();
                          }}
                          placeholder="Confirm password"
                          data-ocid="admin.input"
                          className="font-mono text-sm"
                          style={{
                            background: "oklch(0.09 0.02 235)",
                            borderColor: "oklch(0.25 0.04 230)",
                            color: "oklch(0.85 0.03 220)",
                          }}
                        />
                      </div>
                    )}

                    {authError && (
                      <p
                        data-ocid="admin.error_state"
                        className="text-xs font-mono"
                        style={{ color: "oklch(0.65 0.18 30)" }}
                      >
                        ⚠ {authError}
                      </p>
                    )}

                    <Button
                      onClick={
                        authState === "set-password"
                          ? handleSetPassword
                          : handleLogin
                      }
                      disabled={authLoading || !password}
                      data-ocid="admin.submit_button"
                      className="w-full font-mono text-sm"
                      style={{
                        background:
                          authLoading || !password
                            ? "oklch(0.20 0.03 235)"
                            : "oklch(0.55 0.18 210)",
                        color:
                          authLoading || !password
                            ? "oklch(0.40 0.05 230)"
                            : "oklch(0.95 0.01 220)",
                        border: "none",
                      }}
                    >
                      {authLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : null}
                      {authState === "set-password" ? "Set Password" : "Unlock"}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )}

          {authState === "authenticated" && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-2xl space-y-6"
            >
              {/* Add New Key */}
              <Card
                style={{
                  background: "oklch(0.12 0.025 235)",
                  border: "1px solid oklch(0.65 0.18 210 / 0.2)",
                }}
              >
                <CardHeader className="pb-3">
                  <CardTitle
                    className="text-sm font-mono flex items-center gap-2"
                    style={{ color: "oklch(0.78 0.18 210)" }}
                  >
                    <Plus className="w-4 h-4" />
                    ADD / UPDATE API KEY
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label
                        className="text-xs font-mono"
                        style={{ color: "oklch(0.55 0.08 220)" }}
                      >
                        KEY NAME
                      </Label>
                      <Input
                        value={newKeyName}
                        onChange={(e) => setNewKeyName(e.target.value)}
                        placeholder="e.g. OpenAI API Key"
                        data-ocid="admin.search_input"
                        className="font-mono text-sm"
                        style={{
                          background: "oklch(0.09 0.02 235)",
                          borderColor: "oklch(0.22 0.04 230)",
                          color: "oklch(0.85 0.03 220)",
                        }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label
                        className="text-xs font-mono"
                        style={{ color: "oklch(0.55 0.08 220)" }}
                      >
                        KEY VALUE
                      </Label>
                      <div className="relative">
                        <Input
                          type={showNewKeyValue ? "text" : "password"}
                          value={newKeyValue}
                          onChange={(e) => setNewKeyValue(e.target.value)}
                          placeholder="sk-..."
                          data-ocid="admin.textarea"
                          className="pr-10 font-mono text-sm"
                          style={{
                            background: "oklch(0.09 0.02 235)",
                            borderColor: "oklch(0.22 0.04 230)",
                            color: "oklch(0.85 0.03 220)",
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewKeyValue(!showNewKeyValue)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100 transition-opacity"
                          style={{ color: "oklch(0.65 0.08 220)" }}
                        >
                          {showNewKeyValue ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                  <Button
                    onClick={handleAddKey}
                    disabled={
                      addLoading || !newKeyName.trim() || !newKeyValue.trim()
                    }
                    data-ocid="admin.save_button"
                    className="font-mono text-sm"
                    style={{
                      background:
                        addLoading || !newKeyName.trim() || !newKeyValue.trim()
                          ? "oklch(0.18 0.03 235)"
                          : "oklch(0.50 0.18 160)",
                      color:
                        addLoading || !newKeyName.trim() || !newKeyValue.trim()
                          ? "oklch(0.38 0.04 230)"
                          : "oklch(0.95 0.02 160)",
                      border: "none",
                    }}
                  >
                    {addLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Check className="w-4 h-4 mr-2" />
                    )}
                    Save Key
                  </Button>
                </CardContent>
              </Card>

              {/* Stored Keys */}
              <Card
                style={{
                  background: "oklch(0.12 0.025 235)",
                  border: "1px solid oklch(0.65 0.18 210 / 0.2)",
                }}
              >
                <CardHeader className="pb-3">
                  <CardTitle
                    className="text-sm font-mono flex items-center gap-2"
                    style={{ color: "oklch(0.78 0.18 210)" }}
                  >
                    <Shield className="w-4 h-4" />
                    STORED KEYS
                    <span
                      className="ml-auto text-xs px-2 py-0.5 rounded font-mono"
                      style={{
                        background: "oklch(0.65 0.18 210 / 0.12)",
                        color: "oklch(0.65 0.18 210)",
                      }}
                    >
                      {keys.length}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {keysLoading ? (
                    <div
                      data-ocid="admin.loading_state"
                      className="flex items-center gap-2 py-4 justify-center"
                    >
                      <Loader2
                        className="w-5 h-5 animate-spin"
                        style={{ color: "oklch(0.55 0.12 210)" }}
                      />
                      <span
                        className="text-sm font-mono"
                        style={{ color: "oklch(0.45 0.05 230)" }}
                      >
                        Loading keys...
                      </span>
                    </div>
                  ) : keys.length === 0 ? (
                    <div
                      data-ocid="admin.empty_state"
                      className="text-center py-8"
                    >
                      <KeyRound
                        className="w-8 h-8 mx-auto mb-3 opacity-30"
                        style={{ color: "oklch(0.55 0.10 210)" }}
                      />
                      <p
                        className="text-sm font-mono"
                        style={{ color: "oklch(0.38 0.05 230)" }}
                      >
                        No API keys stored yet
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {keys.map((key, index) => (
                        <motion.div
                          key={key.name}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          data-ocid={`admin.item.${index + 1}`}
                          className="flex items-center gap-3 rounded-lg px-4 py-3"
                          style={{
                            background: "oklch(0.10 0.02 235)",
                            border: "1px solid oklch(0.20 0.03 230 / 0.6)",
                          }}
                        >
                          <div className="flex-1 min-w-0">
                            <p
                              className="text-xs font-mono font-semibold truncate"
                              style={{ color: "oklch(0.75 0.12 215)" }}
                            >
                              {key.name}
                            </p>
                            <p
                              className="text-xs font-mono mt-0.5 truncate"
                              style={{ color: "oklch(0.40 0.04 230)" }}
                            >
                              {key.revealed && key.value
                                ? key.value
                                : "••••••••••••••••"}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRevealKey(key.name, index)}
                            data-ocid={`admin.toggle.${index + 1}`}
                            className="p-1.5 rounded transition-opacity hover:opacity-100 opacity-50"
                            title={key.revealed ? "Hide value" : "Reveal value"}
                            style={{ color: "oklch(0.65 0.08 220)" }}
                          >
                            {key.revealed ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteKey(key.name)}
                            data-ocid={`admin.delete_button.${index + 1}`}
                            className="p-1.5 rounded transition-opacity hover:opacity-100 opacity-40"
                            title="Delete key"
                            style={{ color: "oklch(0.60 0.18 30)" }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="py-4 text-center">
        <p
          className="text-xs font-mono"
          style={{ color: "oklch(0.30 0.04 230)" }}
        >
          © {new Date().getFullYear()}.{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "oklch(0.45 0.08 215)" }}
          >
            Built with ❤ using caffeine.ai
          </a>
        </p>
      </footer>
    </div>
  );
}
