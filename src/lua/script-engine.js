/**
 * ScriptEngine
 * Wasmoon wrapper for executing Lua scripts with timeout protection
 * Provides isolated script execution with access to SNES API
 */

const { LuaFactory } = require('wasmoon');
const fs = require('fs').promises;
const path = require('path');

class ScriptEngine {
  constructor(config = {}) {
    this.factory = new LuaFactory();
    this.timeout = config.timeout || 10000; // 10 second max execution
    this.scriptsDir = config.scriptsDir || path.join(__dirname, '../../scripts');
    this.snesAPI = config.snesAPI; // SNESApi instance
    this.debugMode = config.debugMode !== undefined ? config.debugMode : true;

    this.log('📜 ScriptEngine initialized', 'info');
    this.log(`Scripts directory: ${this.scriptsDir}`, 'info');
    this.log(`Timeout: ${this.timeout}ms`, 'info');
  }

  /**
   * Execute a Lua script file
   * @param scriptName - Name of the script file (e.g., "example-coins.lua")
   * @param giftContext - Context object containing gift information
   * @returns Object with success status, result, and optional error
   */
  async executeScript(scriptName, giftContext) {
    const startTime = Date.now();
    const scriptPath = path.join(this.scriptsDir, scriptName);

    this.log(`Executing script: ${scriptName}`, 'info');

    // Validate script exists
    try {
      await fs.access(scriptPath);
    } catch (error) {
      const errorMsg = `Script not found: ${scriptName}`;
      this.log(errorMsg, 'error');
      return {
        success: false,
        error: errorMsg
      };
    }

    // Read script content
    let scriptContent;
    try {
      scriptContent = await fs.readFile(scriptPath, 'utf-8');
    } catch (error) {
      const errorMsg = `Failed to read script: ${error.message}`;
      this.log(errorMsg, 'error');
      return {
        success: false,
        error: errorMsg
      };
    }

    // Create new Lua engine (isolated execution)
    let lua;
    try {
      lua = await this.factory.createEngine();
    } catch (error) {
      const errorMsg = `Failed to create Lua engine: ${error.message}`;
      this.log(errorMsg, 'error');
      return {
        success: false,
        error: errorMsg
      };
    }

    try {
      // Create SNES API for this gift context
      const api = this.snesAPI.createAPI(giftContext);

      // Expose API to Lua
      lua.global.set('SNES', api);

      // Execute with timeout protection
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Script timeout - exceeded maximum execution time')), this.timeout)
      );

      const executionPromise = lua.doString(scriptContent);

      const result = await Promise.race([executionPromise, timeoutPromise]);

      const executionTime = Date.now() - startTime;
      this.log(`Script completed successfully in ${executionTime}ms`, 'success');

      return {
        success: true,
        result,
        executionTime
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.log(`Script error after ${executionTime}ms: ${error.message}`, 'error');

      // Extract useful error information
      let errorMessage = error.message;
      let lineNumber = null;

      // Parse Lua error messages (format: "[string \"scriptname\"]:line: message")
      const luaErrorMatch = error.message.match(/\[string ".*?"\]:(\d+):\s*(.+)/);
      if (luaErrorMatch) {
        lineNumber = parseInt(luaErrorMatch[1]);
        errorMessage = luaErrorMatch[2];
      }

      return {
        success: false,
        error: errorMessage,
        lineNumber,
        executionTime,
        stack: error.stack
      };

    } finally {
      // Cleanup - close Lua engine
      try {
        lua.global.close();
      } catch (closeError) {
        this.log(`Warning: Failed to close Lua engine: ${closeError.message}`, 'warn');
      }
    }
  }

  /**
   * List available Lua scripts in the scripts directory
   * @returns Array of script filenames
   */
  async listScripts() {
    try {
      // Ensure scripts directory exists
      await fs.mkdir(this.scriptsDir, { recursive: true });

      const files = await fs.readdir(this.scriptsDir);
      const luaScripts = files.filter(f => f.endsWith('.lua'));

      this.log(`Found ${luaScripts.length} Lua scripts`, 'info');
      return luaScripts;

    } catch (error) {
      this.log(`Failed to list scripts: ${error.message}`, 'error');
      return [];
    }
  }

  /**
   * Validate script syntax without executing it
   * @param scriptName - Name of the script file
   * @returns Object with valid status and optional error
   */
  async validateScript(scriptName) {
    const scriptPath = path.join(this.scriptsDir, scriptName);

    try {
      // Read script content
      const scriptContent = await fs.readFile(scriptPath, 'utf-8');

      // Create temporary Lua engine for validation
      const lua = await this.factory.createEngine();

      try {
        // Try to parse the script as a function (syntax check only)
        await lua.doString(`return function() ${scriptContent} end`);

        this.log(`Script validation passed: ${scriptName}`, 'success');
        return { valid: true };

      } catch (error) {
        this.log(`Script validation failed: ${error.message}`, 'error');
        return {
          valid: false,
          error: error.message
        };

      } finally {
        lua.global.close();
      }

    } catch (error) {
      this.log(`Failed to validate script: ${error.message}`, 'error');
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Get the scripts directory path
   * @returns Scripts directory path
   */
  getScriptsDirectory() {
    return this.scriptsDir;
  }

  /**
   * Check if a script exists
   * @param scriptName - Name of the script file
   * @returns true if script exists
   */
  async scriptExists(scriptName) {
    const scriptPath = path.join(this.scriptsDir, scriptName);
    try {
      await fs.access(scriptPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Internal logging helper
   */
  log(message, level = 'info') {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
    const prefix = `[${timestamp}] [ScriptEngine]`;

    switch (level) {
      case 'error':
        console.error(`${prefix} ❌ ${message}`);
        break;
      case 'warn':
        console.warn(`${prefix} ⚠️  ${message}`);
        break;
      case 'success':
        console.log(`${prefix} ✅ ${message}`);
        break;
      default:
        if (this.debugMode) {
          console.log(`${prefix} ${message}`);
        }
    }
  }
}

module.exports = ScriptEngine;
