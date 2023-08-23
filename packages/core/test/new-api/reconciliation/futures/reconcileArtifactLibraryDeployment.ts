import { assert } from "chai";

import { buildModule } from "../../../../src/new-api/build-module";
import { ExecutionResultType } from "../../../../src/new-api/internal/new-execution/types/execution-result";
import {
  DeploymentExecutionState,
  ExecutionSateType,
  ExecutionStatus,
} from "../../../../src/new-api/internal/new-execution/types/execution-state";
import { FutureType } from "../../../../src/new-api/types/module";
import { exampleAccounts } from "../../helpers";
import {
  assertSuccessReconciliation,
  createDeploymentState,
  mockArtifact,
  oneAddress,
  reconcile,
  twoAddress,
} from "../helpers";

describe("Reconciliation - artifact library", () => {
  const exampleAddress = "0x1F98431c8aD98523631AE4a59f267346ea31F984";

  const exampleDeploymentState: DeploymentExecutionState = {
    id: "Example",
    type: ExecutionSateType.DEPLOYMENT_EXECUTION_STATE,
    futureType: FutureType.NAMED_CONTRACT_DEPLOYMENT,
    strategy: "basic",
    status: ExecutionStatus.STARTED,
    dependencies: new Set<string>(),
    networkInteractions: [],
    artifactFutureId: "./artifact.json",
    contractName: "Contract1",
    value: BigInt("0"),
    constructorArgs: [],
    libraries: {},
    from: exampleAccounts[0],
  };

  it("should reconcile unchanged", async () => {
    const submoduleDefinition = buildModule("Submodule", (m) => {
      const safeMath = m.library("SafeMath");

      const mainLib = m.libraryFromArtifact("MainLibrary", mockArtifact, {
        libraries: { SafeMath: safeMath },
      });

      return { safeMath, mainLib };
    });

    const moduleDefinition = buildModule("Module", (m) => {
      const { mainLib } = m.useModule(submoduleDefinition);

      return { mainLib };
    });

    await assertSuccessReconciliation(
      moduleDefinition,
      createDeploymentState(
        {
          ...exampleDeploymentState,
          id: "Submodule:SafeMath",
          futureType: FutureType.NAMED_LIBRARY_DEPLOYMENT,
          status: ExecutionStatus.SUCCESS,
          contractName: "SafeMath",
          result: {
            type: ExecutionResultType.SUCCESS,
            address: exampleAddress,
          },
        },
        {
          ...exampleDeploymentState,
          id: "Submodule:MainLibrary",
          futureType: FutureType.ARTIFACT_LIBRARY_DEPLOYMENT,
          status: ExecutionStatus.STARTED,
          contractName: "MainLibrary",
          libraries: {
            SafeMath: exampleAddress,
          },
        }
      )
    );
  });

  it("should find changes to contract name unreconciliable", async () => {
    const moduleDefinition = buildModule("Module", (m) => {
      const library1 = m.libraryFromArtifact("LibraryChanged", mockArtifact, {
        id: "Example",
      });

      return { contract1: library1 };
    });

    const reconiliationResult = await reconcile(
      moduleDefinition,
      createDeploymentState({
        ...exampleDeploymentState,
        id: "Module:Example",
        futureType: FutureType.ARTIFACT_LIBRARY_DEPLOYMENT,
        status: ExecutionStatus.STARTED,
        contractName: "LibraryUnchanged",
      })
    );

    assert.deepStrictEqual(reconiliationResult.reconciliationFailures, [
      {
        futureId: "Module:Example",
        failure:
          "Contract name has been changed from LibraryUnchanged to LibraryChanged",
      },
    ]);
  });

  it("should find changes to libraries unreconciliable", async () => {
    const moduleDefinition = buildModule("Module", (m) => {
      const safeMath = m.library("SafeMath");

      const mainLib = m.libraryFromArtifact("MainLibrary", mockArtifact, {
        libraries: { Changed: safeMath },
      });

      return { safeMath, mainLib };
    });

    const reconiliationResult = await reconcile(
      moduleDefinition,
      createDeploymentState(
        {
          ...exampleDeploymentState,
          id: "Module:SafeMath",
          futureType: FutureType.NAMED_LIBRARY_DEPLOYMENT,
          status: ExecutionStatus.SUCCESS,
          contractName: "SafeMath",
          result: {
            type: ExecutionResultType.SUCCESS,
            address: exampleAddress,
          },
        },
        {
          ...exampleDeploymentState,
          id: "Module:MainLibrary",
          futureType: FutureType.ARTIFACT_LIBRARY_DEPLOYMENT,
          status: ExecutionStatus.STARTED,
          contractName: "MainLibrary",
          libraries: {
            Unchanged: exampleAddress,
          },
        }
      )
    );

    assert.deepStrictEqual(reconiliationResult.reconciliationFailures, [
      {
        futureId: "Module:MainLibrary",
        failure: "Library Unchanged has been removed",
      },
    ]);
  });

  it("should find changes to contract name unreconciliable", async () => {
    const moduleDefinition = buildModule("Module", (m) => {
      const library1 = m.libraryFromArtifact("Library1", mockArtifact, {
        id: "Example",
        from: twoAddress,
      });

      return { contract1: library1 };
    });

    const reconiliationResult = await reconcile(
      moduleDefinition,
      createDeploymentState({
        ...exampleDeploymentState,
        id: "Module:Example",
        futureType: FutureType.ARTIFACT_LIBRARY_DEPLOYMENT,
        status: ExecutionStatus.STARTED,
        contractName: "Library1",
        from: oneAddress,
      })
    );

    assert.deepStrictEqual(reconiliationResult.reconciliationFailures, [
      {
        futureId: "Module:Example",
        failure: `From account has been changed from ${oneAddress} to ${twoAddress}`,
      },
    ]);
  });
});
