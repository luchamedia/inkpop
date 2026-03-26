import { SignUp } from "@clerk/nextjs"

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background-secondary">
      <SignUp
        appearance={{
          variables: {
            colorPrimary: "#2B2926",
            colorText: "#373530",
            borderRadius: "4px",
            fontFamily: "Inter, system-ui, sans-serif",
          },
        }}
      />
    </div>
  )
}
