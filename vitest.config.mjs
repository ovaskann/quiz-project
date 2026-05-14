import { defineConfig } from "vitest/config";
import dotenv from "dotenv";

dotenv.config({ path: ".env.test" });

export default defineConfig({
    test: { 
        environment: "node", 
        globals: true,
        fileParallelism: false,
        coverage: {
            provider: "v8",
            reporter: ["text", "html"],
            include: ["src/**/*.js"],
            exclude: ["src/generated/**", "src/index.js"],
        }  
    }
});
