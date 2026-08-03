import { earlyAccessApi } from "../api/early-access";
import { readLatestScannerSnapshot } from "./scanner-storage";

export async function assignLatestClaimedScanToCompany(companyId: string): Promise<boolean> {
  const latestScan = readLatestScannerSnapshot();
  if (!latestScan) return false;

  const earlyAccess = await earlyAccessApi.getMine();
  const claimedScan = earlyAccess.scans.find((scan) => scan.id === latestScan.id);
  if (!earlyAccess.grant || !claimedScan || claimedScan.companyId) return false;

  await earlyAccessApi.assignScan(claimedScan.id, companyId);
  return true;
}
