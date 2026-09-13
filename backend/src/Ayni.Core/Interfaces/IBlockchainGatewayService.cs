// SPDX-License-Identifier: MIT
namespace Ayni.Core.Interfaces;

public interface IBlockchainGatewayService
{
    string RecoverSignerAddress(string message, string signature);
    bool VerifySiweSignature(string expectedAddress, string message, string signature);
    string ComputeSaltedCommitment(string hardwareId, string salt, string sellerAddress);
}
