import { redirect } from "next/navigation";
import { getSetupStep } from "@/lib/setup-state";
import { SetupWizard } from "./setup-wizard";

type Props = {
  searchParams: Promise<{ done?: string; mid?: string }>;
};

export default async function SetupPage({ searchParams }: Props) {
  const sp = await searchParams;
  const step = await getSetupStep();
  const doneSuccess = sp.done === "1";

  if (step === "complete" && !doneSuccess) {
    redirect("/blog");
  }

  return (
    <SetupWizard
      initialStep={step}
      doneSuccess={doneSuccess}
      restartHint={sp.mid === "1"}
    />
  );
}
