// SPDX-License-Identifier: MIT
using FluentAssertions;
using Nethereum.Signer;
using Ayni.Infrastructure.Services;

namespace Ayni.Tests;

public class BlockchainGatewayTests
{
    private readonly BlockchainGatewayService _service;

    public BlockchainGatewayTests()
    {
        _service = new BlockchainGatewayService();
    }

    [Fact]
    public void VerifySiweSignature_WithValidSignature_ShouldReturnTrue()
    {
        // Setup a synthetic Ethereum private key and wallet
        var testPrivateKey = "0x4c0883a69102937a638ec081b3716da7d62f689f928a3f890d297ffb0e0081d4";
        var key = new EthECKey(testPrivateKey);
        var expectedAddress = key.GetPublicAddress();

        var message = "Ayni Sign-In: Nonce 1234567890abcdef at 2026-09-12";
        var signer = new EthereumMessageSigner();
        var signature = signer.EncodeUTF8AndSign(message, key);

        var isValid = _service.VerifySiweSignature(expectedAddress, message, signature);

        isValid.Should().BeTrue("a valid ECDSA signature matching the signer public address must verify");
    }

    [Fact]
    public void VerifySiweSignature_WithMismatchedAddress_ShouldReturnFalse()
    {
        var testPrivateKey = "0x4c0883a69102937a638ec081b3716da7d62f689f928a3f890d297ffb0e0081d4";
        var key = new EthECKey(testPrivateKey);
        var wrongAddress = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

        var message = "Ayni Sign-In: Nonce 1234567890abcdef";
        var signer = new EthereumMessageSigner();
        var signature = signer.EncodeUTF8AndSign(message, key);

        var isValid = _service.VerifySiweSignature(wrongAddress, message, signature);

        isValid.Should().BeFalse("signature from another private key must not match the expected address");
    }

    [Fact]
    public void ComputeSaltedCommitment_ShouldProduceConsistentKeccak256Hash()
    {
        var imei = "354892091234569";
        var salt = "0x9876543210abcdef";
        var sellerAddress = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8";

        var commitment1 = _service.ComputeSaltedCommitment(imei, salt, sellerAddress);
        var commitment2 = _service.ComputeSaltedCommitment(imei, salt, sellerAddress);

        commitment1.Should().NotBeNullOrEmpty();
        commitment1.Should().StartWith("0x");
        commitment1.Length.Should().Be(66); // 0x + 64 hex chars (32 bytes)
        commitment1.Should().Be(commitment2, "deterministic salted hashing must produce identical outputs for same inputs");

        // Changing the salt must produce a totally different commitment
        var commitmentDifferentSalt = _service.ComputeSaltedCommitment(imei, "0xdifferent_salt_123", sellerAddress);
        commitmentDifferentSalt.Should().NotBe(commitment1);
    }
}
