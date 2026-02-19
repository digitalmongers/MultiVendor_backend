import argon2 from 'argon2';

const testArgon = async () => {
    const password = 'Digital1234#';
    try {
        console.log(`Password to hash: ${password}`);
        const hash = await argon2.hash(password);
        console.log(`Generated Hash: ${hash}`);

        const isMatch = await argon2.verify(hash, password);
        console.log(`Match Result: ${isMatch}`);

        if (isMatch) {
            console.log('Argon2 is working correctly.');
        } else {
            console.log('CRITICAL: Argon2 verification failed for its own hash!');
        }
        process.exit(0);
    } catch (err) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
    }
};

testArgon();
