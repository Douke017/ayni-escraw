// SPDX-License-Identifier: MIT
using Nethereum.ABI;
using Nethereum.Hex.HexConvertors.Extensions;
using Nethereum.Signer;
using Ayni.Core.Interfaces;

namespace Ayni.Infrastructure.Services;

public class BlockchainGatewayService : IBlockchainGatewayService
{
    private readonly EthereumMessageSigner _messageSigner;
    private readonly ABIEncode _abiEncode;

    public BlockchainGatewayService()
    {
        _messageSigner = new EthereumMessageSigner();
        _abiEncode = new ABIEncode();
    }

    public string RecoverSignerAddress(string message, string signature)
    {
        return _messageSigner.EncodeUTF8AndEcRecover(message, signature);
    }

    public bool VerifySiweSignature(string expectedAddress, string message, string signature)
    {
        try
        {
            var recovered = RecoverSignerAddress(message, signature);
            return string.Equals(recovered, expectedAddress, StringComparison.OrdinalIgnoreCase);
        }
        catch
        {
            return false;
        }
    }

    public string ComputeSaltedCommitment(string hardwareId, string salt, string sellerAddress)
    {
        var packedHash = _abiEncode.GetSha3ABIEncodedPacked(
            new ABIValue("string", hardwareId),
            new ABIValue("string", salt),
            new ABIValue("address", sellerAddress)
        );

        return packedHash.ToHex(true);
    }
}
