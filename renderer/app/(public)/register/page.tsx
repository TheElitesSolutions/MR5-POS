"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/authStore";
import {
  registerSchema,
  RegisterFormData,
  checkPasswordStrength,
} from "@/lib/validation";
import { RegisterRequest, Role } from "@/types";

const PasswordStrengthIndicator = ({
  password,
}: {
  password: string | undefined;
}) => {
  const { score, feedback, isStrong } = checkPasswordStrength(password || "");

  if (!password || password.length === 0) return null;

  const getStrengthColor = (score: number) => {
    if (score < 2) return "bg-red-500";
    if (score < 4) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getStrengthText = (score: number) => {
    if (score < 2) return "Weak";
    if (score < 4) return "Medium";
    return "Strong";
  };

  return (
    <div className="mt-3">
      <div className="flex items-center space-x-3">
        <div className="flex-1 bg-muted rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all ${getStrengthColor(
              score
            )}`}
            style={{ width: `${(score / 5) * 100}%` }}
          />
        </div>
        <span
          className={`text-xs font-medium ${
            isStrong ? "text-success" : "text-muted-foreground"
          }`}
        >
          {getStrengthText(score)}
        </span>
      </div>
      {feedback.length > 0 && (
        <ul className="mt-2 text-xs text-muted-foreground">
          {feedback.map((item, index) => (
            <li key={index}>• {item}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default function RegisterPage() {
  const router = useRouter();
  const { toast } = useToast();
  const {
    register: registerUser,
    isLoading,
    error,
    clearError,
  } = useAuthStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      role: "EMPLOYEE",
    },
  });

  const password = watch("password");

  const onSubmit = async (data: RegisterFormData) => {
    try {
      setIsSubmitting(true);
      clearError();

      // Remove confirmPassword from data before sending to API
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { confirmPassword, ...registerData } = data;

      await registerUser(registerData as RegisterRequest);

      toast({
        title: "Registration successful",
        description: "Please log in with your new account",
      });

      router.push("/login");
    } catch (error: Error | unknown) {
      console.error("Registration error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to register. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-16 px-6">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            The Elites POS
          </h1>
          <p className="text-muted-foreground">Create your POS account</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create your account</CardTitle>
            <CardDescription>
              Fill in your details to create a new POS account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-3">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter your username"
                  {...register("username")}
                  className={errors.username ? "border-destructive" : ""}
                  disabled={isSubmitting}
                />
                {errors.username && (
                  <p className="text-sm text-destructive">
                    {errors.username.message}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Enter your full name"
                  {...register("name")}
                  className={errors.name ? "border-destructive" : ""}
                  disabled={isSubmitting}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-3">
                <Label htmlFor="role">Role</Label>
                <Select
                  onValueChange={(value) => setValue("role", value as Role)}
                  defaultValue="EMPLOYEE"
                  disabled={isSubmitting}
                >
                  <SelectTrigger
                    className={errors.role ? "border-destructive" : ""}
                  >
                    <SelectValue placeholder="Select your role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EMPLOYEE">Employee</SelectItem>
                    <SelectItem value="MANAGER">Manager</SelectItem>
                    <SelectItem value="OWNER">Owner</SelectItem>
                  </SelectContent>
                </Select>
                {errors.role && (
                  <p className="text-sm text-destructive">{errors.role.message}</p>
                )}
              </div>

              <div className="space-y-3">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  {...register("password")}
                  className={errors.password ? "border-destructive" : ""}
                  disabled={isSubmitting}
                />
                <PasswordStrengthIndicator password={password} />
                {errors.password && (
                  <p className="text-sm text-destructive">
                    {errors.password.message}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm your password"
                  {...register("confirmPassword")}
                  className={errors.confirmPassword ? "border-destructive" : ""}
                  disabled={isSubmitting}
                />
                {errors.confirmPassword && (
                  <p className="text-sm text-destructive">
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>

              {error && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || isSubmitting}
              >
                {isLoading || isSubmitting
                  ? "Creating account..."
                  : "Create account"}
              </Button>
            </form>

            <div className="mt-8 text-center">
              <p className="text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="font-medium text-primary hover:text-primary/90"
                >
                  Sign in here
                </Link>
              </p>
            </div>

            <div className="mt-6 text-xs text-muted-foreground text-center">
              <p>🔒 Secure registration with password strength validation</p>
              <p>Rate limited for security</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
